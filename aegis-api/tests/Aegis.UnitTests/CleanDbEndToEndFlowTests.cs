using Aegis.Application.DTOs;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Aegis.UnitTests;

public class CleanDbEndToEndFlowTests
{
    private sealed class StubAuditService : IAuditService
    {
        public List<string> Actions { get; } = new();
        public Task<AuditLogEntry> AppendAsync(string entityName, string entityId, string action, string actorId, string actorRole, object details, CancellationToken cancellationToken = default)
        {
            Actions.Add(action);
            return Task.FromResult(new AuditLogEntry { EntityName = entityName, EntityId = entityId, Action = action, ActorId = actorId, ActorRole = actorRole });
        }
        public Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<(bool, long?, string?)>((true, null, null));
    }

    [Fact]
    public async Task Full_CleanDb_Flow_Request_Email_AiRecommendation_Decision_CitizenEmail_And_Chat()
    {
        var opts = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new AegisDbContext(opts);

        var audit = new StubAuditService();
        var ai = new RuleBasedAiProvider(db, NullLogger<RuleBasedAiProvider>.Instance);
        var gov = new AiGovernanceService(db, audit);
        var reqSvc = new RequestService(db, ai, audit, NullLogger<RequestService>.Instance, null, gov);
        var decSvc = new DecisionService(db, audit, NullLogger<DecisionService>.Instance);

        // 1. Citizen submits request with GPS map location + contact email
        var created = await reqSvc.CreateRequestAsync(
            new CreateRequestDto(null, "Water", "Drinking water needed for 4 people", "en", "Colombo", 6.9271, 79.8612, 4, 3, true, null, "0770001122", "citizen@example.lk"),
            "citizen-1",
            "idem-clean-1");

        Assert.Equal(6.9271, created.Latitude);
        Assert.Equal(79.8612, created.Longitude);
        Assert.NotNull(created.RecommendationId);

        // 2. Request-received email queued in NotificationOutbox
        var outboxesAfterCreate = await db.NotificationOutboxes.ToListAsync();
        Assert.Single(outboxesAfterCreate);
        Assert.Equal("citizen@example.lk", outboxesAfterCreate[0].Recipient);

        // 3. AI recommendation is visible to staff
        var rec = await decSvc.GetLatestForRequestAsync(created.Id);
        Assert.NotNull(rec);
        Assert.Equal("Pending", rec!.Status);
        Assert.False(string.IsNullOrWhiteSpace(rec.CounterfactualNote));

        // 4. Staff records human decision -> citizen notification queued + audit sealed
        var decision = await decSvc.RecordDecisionAsync(
            rec.Id,
            new DecisionRequestDto("Approve", "Approved for immediate water dispatch.", null, null, null),
            "coord-1",
            AegisRoles.EmergencyCoordinator);
        Assert.Equal("Approve", decision.Action);

        var outboxesAfterDecision = await db.NotificationOutboxes.ToListAsync();
        Assert.True(outboxesAfterDecision.Count >= 2);

        // 5. Two-way chat between citizen and coordinator
        var citMsg = await reqSvc.SendMessageAsync(created.Id.ToString(), "We are near the school gate.", "citizen-1", AegisRoles.Citizen, "Citizen");
        var staffMsg = await reqSvc.SendMessageAsync(created.Id.ToString(), "Team is on the way.", "coord-1", AegisRoles.EmergencyCoordinator, "Coordinator");
        Assert.True(citMsg.IsSuccess);
        Assert.True(staffMsg.IsSuccess);

        var thread = await reqSvc.GetMessagesAsync(created.Id.ToString(), "citizen-1", AegisRoles.Citizen);
        Assert.True(thread.Count >= 2);
        Assert.Contains(thread, m => m.MessageText.Contains("school gate"));
        Assert.Contains(thread, m => m.MessageText.Contains("on the way"));
        Assert.Contains(audit.Actions, a => a == "Create");
        Assert.Contains(audit.Actions, a => a == "Approve");
    }
}

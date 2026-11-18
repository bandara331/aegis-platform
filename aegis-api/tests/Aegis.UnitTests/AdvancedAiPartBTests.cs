using System.Net;
using System.Text;
using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Aegis.UnitTests;

public class AdvancedAiPartBTests
{
    private sealed class StubAuditService : IAuditService
    {
        public Task<AuditLogEntry> AppendAsync(string entityName, string entityId, string action, string actorId, string actorRole, object details, CancellationToken cancellationToken = default)
            => Task.FromResult(new AuditLogEntry { EntityName = entityName, EntityId = entityId, Action = action, ActorId = actorId, ActorRole = actorRole });
        public Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<(bool, long?, string?)>((true, null, null));
    }

    private sealed class StubSignalPublisher : IRealtimeSignalPublisher
    {
        public List<(string EventType, object Payload)> Published { get; } = new();
        public Task PublishAsync(string eventType, object payload, CancellationToken cancellationToken = default)
        {
            Published.Add((eventType, payload));
            return Task.CompletedTask;
        }
    }
    private static AegisDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AegisDbContext(opts);
    }

    private sealed class StubHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;
        public StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) => _handler = handler;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_handler(request));
    }

    private static IConfiguration EmptyConfig() =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();

    [Fact]
    public async Task Distress_Escalation_Raises_Priority_Floor_And_Never_Lowers_Critical()
    {
        await using var db = CreateDb();
        var lowReq = new AssistanceRequest
        {
            TrackingNumber = "AEG-B-1",
            CitizenId = "cit-1",
            Category = "Food",
            Area = "Colombo",
            Description = "Need food",
            Priority = RequestPriority.Low,
            UrgencyScore = 30
        };
        var critReq = new AssistanceRequest
        {
            TrackingNumber = "AEG-B-2",
            CitizenId = "cit-2",
            Category = "Medical",
            Area = "Galle",
            Description = "Heart attack",
            Priority = RequestPriority.Critical,
            UrgencyScore = 95
        };
        db.AssistanceRequests.AddRange(lowReq, critReq);
        await db.SaveChangesAsync();

        var audit = new StubAuditService();
        var signalPub = new StubSignalPublisher();
        var distressSvc = new GroqDistressDetectionService(
            new HttpClient(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK))),
            EmptyConfig(),
            NullLogger<GroqDistressDetectionService>.Instance);

        var reqSvc = new RequestService(
            db,
            new RuleBasedAiProvider(db, NullLogger<RuleBasedAiProvider>.Instance),
            audit,
            NullLogger<RequestService>.Instance,
            null,
            null,
            distressSvc,
            signalPub);

        // Citizen sends high-distress Singlish/English message on Low priority request
        var res1 = await reqSvc.SendMessageAsync(lowReq.Id.ToString(), "hirawela wathura gedara athule, drowning!", "cit-1", AegisRoles.Citizen, "Citizen 1");
        Assert.True(res1.IsSuccess);

        var updatedLow = await db.AssistanceRequests.FindAsync(lowReq.Id);
        Assert.Equal(RequestPriority.Critical, updatedLow!.Priority);
        Assert.True(updatedLow.DistressFlagged);
        Assert.Equal("high", updatedLow.DistressLevel);

        Assert.Single(signalPub.Published);
        Assert.Equal("distress.high", signalPub.Published[0].EventType);

        // Citizen sends normal message on already-Critical request: priority must NEVER be lowered
        var res2 = await reqSvc.SendMessageAsync(critReq.Id.ToString(), "thank you, waiting outside", "cit-2", AegisRoles.Citizen, "Citizen 2");
        Assert.True(res2.IsSuccess);
        var updatedCrit = await db.AssistanceRequests.FindAsync(critReq.Id);
        Assert.Equal(RequestPriority.Critical, updatedCrit!.Priority);
    }

    [Fact]
    public void Filter_Json_Whitelist_Rejects_Unknown_Fields_And_Injection_Attempts()
    {
        // Unknown field rejected
        Assert.Null(NlSearchFilterWhitelist.ValidateAndSanitize("{\"priority\":\"Critical\",\"rawSql\":\"SELECT * FROM users\"}"));

        // SQL injection rejected
        Assert.Null(NlSearchFilterWhitelist.ValidateAndSanitize("{\"district\":\"Colombo; DROP TABLE assistance_requests--\"}"));

        // Invalid enum value rejected
        Assert.Null(NlSearchFilterWhitelist.ValidateAndSanitize("{\"priority\":\"SuperMax\"}"));

        // Valid whitelisted JSON accepted
        var valid = NlSearchFilterWhitelist.ValidateAndSanitize("{\"status\":\"Submitted\",\"priority\":\"Critical\",\"district\":\"Colombo\",\"unassigned\":true,\"dateRange\":\"24h\"}");
        Assert.NotNull(valid);
        Assert.Equal("Submitted", valid!.Status);
        Assert.Equal("Critical", valid.Priority);
        Assert.Equal("Colombo", valid.District);
        Assert.True(valid.Unassigned);
        Assert.Equal("24h", valid.DateRange);
    }

    [Fact]
    public async Task Handover_Only_Uses_Permitted_Staff_Data_And_Active_Distress()
    {
        await using var db = CreateDb();
        var mine = new AssistanceRequest { TrackingNumber = "AEG-MINE", Area = "Kandy", Category = "Water", Description = "mine", UpdatedAt = DateTime.UtcNow };
        var other = new AssistanceRequest { TrackingNumber = "AEG-OTHER", Area = "Matara", Category = "Food", Description = "other", UpdatedAt = DateTime.UtcNow };
        db.AssistanceRequests.AddRange(mine, other);
        db.AuditLogEntries.Add(new AuditLogEntry
        {
            EntityName = "AssistanceRequest",
            EntityId = mine.Id.ToString(),
            Action = "Update",
            ActorId = "staff-A",
            ActorRole = "EmergencyCoordinator",
            TimestampUtc = DateTime.UtcNow
        });
        db.AuditLogEntries.Add(new AuditLogEntry
        {
            EntityName = "AssistanceRequest",
            EntityId = other.Id.ToString(),
            Action = "Update",
            ActorId = "staff-B",
            ActorRole = "EmergencyCoordinator",
            TimestampUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var copilot = new AiCopilotService(
            db,
            new StubAuditService(),
            new HttpClient(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK))),
            EmptyConfig(),
            NullLogger<AiCopilotService>.Instance);

        var handover = await copilot.GenerateHandoverAsync("staff-A", DateTime.UtcNow.AddHours(-8));
        Assert.Single(handover.Items);
        Assert.Equal("AEG-MINE", handover.Items[0].TrackingNumber);
    }

    [Fact]
    public async Task Drafts_Never_AutoSend_Messages_Or_AutoPublish_Reports()
    {
        await using var db = CreateDb();
        var req = new AssistanceRequest
        {
            TrackingNumber = "AEG-DRAFT-1",
            CitizenId = "cit-9",
            Category = "Medical",
            Area = "Colombo",
            Language = "si",
            DetectedLanguage = "si",
            Description = "බෙහෙත් අවශ්‍යයි"
        };
        db.AssistanceRequests.Add(req);
        await db.SaveChangesAsync();

        var groqReply = new
        {
            choices = new[] { new { message = new { content = "{\"draftText\":\"අපගේ කණ්ඩායම පරීක්ෂා කරයි.\"}" } } }
        };
        var handler = new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(groqReply), Encoding.UTF8, "application/json")
        });
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Groq:ApiKey"] = "test-key" })
            .Build();

        var copilot = new AiCopilotService(
            db,
            new StubAuditService(),
            new HttpClient(handler),
            cfg,
            NullLogger<AiCopilotService>.Instance);

        var reply = await copilot.SuggestReplyAsync(req.Id, "staff-1");
        Assert.False(string.IsNullOrWhiteSpace(reply.DraftText));
        // Suggesting a reply must NEVER insert a chat message into RequestHistories
        Assert.Empty(await db.RequestHistories.ToListAsync());

        // Daily report draft must stay Draft, never auto-published, and report missing weather honestly
        var draft = await copilot.GenerateDailySituationDraftAsync("staff-1");
        Assert.Equal("Draft", draft.Status);
        Assert.True(draft.IsAiAssisted);
        Assert.Null(draft.PublishedAt);
        Assert.Contains("No weather snapshots recorded in database", draft.ContentMarkdown);
    }
}

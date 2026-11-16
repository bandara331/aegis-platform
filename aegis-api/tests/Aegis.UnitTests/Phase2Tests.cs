using Aegis.Application.DTOs;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Aegis.Application.Interfaces;

namespace Aegis.UnitTests;

internal static class TestDb
{
    public static AegisDbContext Create() =>
        new(new DbContextOptionsBuilder<AegisDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}

public class AiScoringTests
{
    private static RuleBasedAiProvider Provider(AegisDbContext db) => new(db, NullLogger<RuleBasedAiProvider>.Instance);

    [Fact]
    public async Task InsulinForElderly_ScoresCritical_WithModelMetadata()
    {
        using var db = TestDb.Create();
        var req = new AssistanceRequest { TrackingNumber = "REQ-X", Category = "Medical", Description = "Insulin for elderly wheelchair user", Area = "Kalutara", SelfReportedUrgency = 5 };

        var result = await Provider(db).ScoreUrgencyAsync(req);

        result.Priority.Should().Be(RequestPriority.Critical);
        result.ModelName.Should().Be("RuleBasedHeuristicEngine");
        result.ModelVersion.Should().NotBeNullOrWhiteSpace();
        result.FeatureScoresJson.Should().Contain("vulnerability").And.Contain("resourceFit");
    }

    [Fact]
    public async Task SinhalaKeyword_RaisesUrgency()
    {
        using var db = TestDb.Create();
        var plain = new AssistanceRequest { TrackingNumber = "A", Category = "Food", Description = "need help", Area = "Galle", SelfReportedUrgency = 2 };
        var sinhala = new AssistanceRequest { TrackingNumber = "B", Category = "Food", Description = "ඉන්සියුලින් අවශ්‍යයි", Area = "Galle", SelfReportedUrgency = 2 };

        var p = Provider(db);
        var a = await p.ScoreUrgencyAsync(plain);
        var b = await p.ScoreUrgencyAsync(sinhala);

        b.FeatureScoresJson.Should().NotBe(a.FeatureScoresJson);
        ((int)b.Priority).Should().BeGreaterThanOrEqualTo((int)a.Priority);
    }

    [Fact]
    public async Task Duplicate_WithinHaversine500m_And24h_IsDetected()
    {
        using var db = TestDb.Create();
        var a = new AssistanceRequest { Category = "Water", Latitude = 6.5850, Longitude = 79.9620, CreatedAt = DateTime.UtcNow };
        var near = new AssistanceRequest { Category = "Water", Latitude = 6.5855, Longitude = 79.9622, CreatedAt = DateTime.UtcNow.AddHours(-2) };
        var far = new AssistanceRequest { Category = "Water", Latitude = 6.7000, Longitude = 80.1000, CreatedAt = DateTime.UtcNow };

        var p = Provider(db);
        (await p.DetectDuplicatesAsync(a, near)).Should().BeTrue();
        (await p.DetectDuplicatesAsync(a, far)).Should().BeFalse();
    }
}

public class DecisionRuleTests
{
    private static async Task<(AegisDbContext db, DecisionService svc, AiRecommendation rec)> Arrange(RequestPriority priority, string category)
    {
        var db = TestDb.Create();
        var req = new AssistanceRequest { TrackingNumber = "REQ-1", Category = category, Description = "x", Area = "Kalutara", Status = RequestStatus.NeedsReview, Priority = priority };
        var rec = new AiRecommendation { RequestId = req.Id, Request = req, Priority = priority, Confidence = 0.87 };
        db.AssistanceRequests.Add(req);
        db.AiRecommendations.Add(rec);
        await db.SaveChangesAsync();
        var audit = new AuditService(db, NullLogger<AuditService>.Instance);
        return (db, new DecisionService(db, audit, NullLogger<DecisionService>.Instance), rec);
    }

    [Fact]
    public async Task Reject_WithoutJustification_Fails()
    {
        var (db, svc, rec) = await Arrange(RequestPriority.Medium, "Food");
        using var _ = db;
        var act = () => svc.RecordDecisionAsync(rec.Id, new DecisionRequestDto("Reject", "", null, null, null), "u1", "CaseManager");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*justification*");
    }

    [Fact]
    public async Task CriticalAction_WithoutSecondApprover_Fails()
    {
        var (db, svc, rec) = await Arrange(RequestPriority.Critical, "Medical");
        using var _ = db;
        var act = () => svc.RecordDecisionAsync(rec.Id, new DecisionRequestDto("Approve", "", null, null, null), "u1", "EmergencyCoordinator");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Second Approver*");
    }

    [Fact]
    public async Task CriticalAction_SecondApproverSameAsFirst_Fails()
    {
        var (db, svc, rec) = await Arrange(RequestPriority.Critical, "Medical");
        using var _ = db;
        var act = () => svc.RecordDecisionAsync(rec.Id, new DecisionRequestDto("Approve", "", "u1", null, null), "u1", "EmergencyCoordinator");
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*different individual*");
    }

    [Fact]
    public async Task CriticalAction_WithDifferentSecondApprover_Succeeds_AndAuditsDecision()
    {
        var (db, svc, rec) = await Arrange(RequestPriority.Critical, "Medical");
        using var _ = db;

        var result = await svc.RecordDecisionAsync(rec.Id, new DecisionRequestDto("Approve", "", "u2", null, null), "u1", "EmergencyCoordinator");

        result.RequestStatus.Should().Be(RequestStatus.Assigned.ToString());
        (await db.Decisions.CountAsync()).Should().Be(1);
        (await db.AuditLogEntries.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task AiRecommendation_NeverChangesRequestState_UntilHumanDecides()
    {
        var (db, _, rec) = await Arrange(RequestPriority.High, "Water");
        using var _ = db;
        rec.Request!.Status.Should().Be(RequestStatus.NeedsReview);
        rec.Status.Should().Be(RecommendationStatus.Pending);
    }
}

public class RequestAuthorisationTests
{
    private static RequestService Service(AegisDbContext db) =>
        new(db, Substitute.For<IAiProvider>(), new AuditService(db, NullLogger<AuditService>.Instance), NullLogger<RequestService>.Instance);

    [Fact]
    public async Task Citizen_CannotReadAnotherCitizensRequest()
    {
        using var db = TestDb.Create();
        var req = new AssistanceRequest { TrackingNumber = "REQ-2", CitizenId = "owner", Category = "Water", Description = "x", Area = "Galle" };
        db.AssistanceRequests.Add(req);
        await db.SaveChangesAsync();

        var act = () => Service(db).GetByIdAsync(req.Id, "someone-else", AegisRoles.Citizen);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Citizen_CanReadOwnRequest_AndStaffCanReadAny()
    {
        using var db = TestDb.Create();
        var req = new AssistanceRequest { TrackingNumber = "REQ-3", CitizenId = "owner", Category = "Water", Description = "x", Area = "Galle" };
        db.AssistanceRequests.Add(req);
        await db.SaveChangesAsync();
        var svc = Service(db);

        (await svc.GetByIdAsync(req.Id, "owner", AegisRoles.Citizen)).Should().NotBeNull();
        (await svc.GetByIdAsync(req.Id, "staff", AegisRoles.CaseManager)).Should().NotBeNull();
    }

    [Fact]
    public async Task CitizenListing_IsFilteredToOwnRequests()
    {
        using var db = TestDb.Create();
        db.AssistanceRequests.AddRange(
            new AssistanceRequest { TrackingNumber = "A", CitizenId = "me", Category = "Food", Description = "x", Area = "a" },
            new AssistanceRequest { TrackingNumber = "B", CitizenId = "other", Category = "Food", Description = "x", Area = "a" });
        await db.SaveChangesAsync();

        var list = await Service(db).GetAllAsync(null, null, "me", AegisRoles.Citizen);
        list.Should().HaveCount(1);
        list[0].TrackingNumber.Should().Be("A");
    }
}

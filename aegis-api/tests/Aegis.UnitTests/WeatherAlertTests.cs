using Aegis.Application.DTOs;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Identity;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aegis.UnitTests;

public class WeatherAlertTests
{
    private static AegisDbContext CreateDb() => new(
        new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase($"WeatherAlertTests_{Guid.NewGuid()}")
            .Options);

    private static IConfiguration CreateConfig(Dictionary<string, string?>? extra = null)
    {
        var dict = new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "test-signing-key-32-chars-minimum-length",
            ["EmergencyContacts:Dmc"] = "117",
            ["EmergencyContacts:Police"] = "119",
            ["EmergencyContacts:Ambulance"] = "1990",
            ["Email:DailyLimit"] = "10",
            ["Frontend:Origin"] = "https://aegis-platform-seven.vercel.app"
        };
        if (extra != null)
        {
            foreach (var kv in extra) dict[kv.Key] = kv.Value;
        }
        return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
    }

    private sealed class StubAuditService : IAuditService
    {
        public List<(string EntityType, string EntityId, string Action)> Entries { get; } = [];
        public Task<AuditLogEntry> AppendAsync(string entityType, string entityId, string action, string actorId, string actorRole, object details, CancellationToken cancellationToken = default)
        {
            Entries.Add((entityType, entityId, action));
            return Task.FromResult(new AuditLogEntry { Action = action, ActorId = actorId, ActorRole = actorRole });
        }
        public Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)>((true, null, null));
    }

    [Fact]
    public void ThresholdCrossingAndHysteresis_ShouldEvaluateCorrectly()
    {
        var rule = new WeatherAlertRule
        {
            Rainfall24hHighMm = 80,
            Rainfall24hSevereMm = 150,
            HysteresisMargin = 0.10
        };

        var highSnap = new DistrictRiskSnapshot { District = "Colombo", RiskLevel = "Medium", Rainfall24hMm = 90 };
        Assert.Equal("High", WeatherAlertLogic.EvaluateLevel(highSnap, rule));

        var borderlineDropSnap = new DistrictRiskSnapshot { District = "Colombo", RiskLevel = "Medium", Rainfall24hMm = 76 }; // 76 >= 80 * 0.9 (72)
        Assert.False(WeatherAlertLogic.HasDroppedWithHysteresis(borderlineDropSnap, rule));

        var clearDropSnap = new DistrictRiskSnapshot { District = "Colombo", RiskLevel = "Low", Rainfall24hMm = 40 };
        Assert.True(WeatherAlertLogic.HasDroppedWithHysteresis(clearDropSnap, rule));
    }

    [Fact]
    public void NumberValidator_ShouldRejectInventedFigures()
    {
        var facts = new[] { 95.5, 210.0, 450.0 };
        var contacts = new[] { "117", "119", "1990" };

        Assert.True(WeatherAlertLogic.ValidateNumbersInText(
            "Colombo rainfall 95.5 mm in 24h, 210 mm in 72h, river 450 m3/s. Call 117.", facts, contacts));

        Assert.False(WeatherAlertLogic.ValidateNumbersInText(
            "Colombo rainfall 95.5 mm and 9999 people evacuated.", facts, contacts));
    }

    [Fact]
    public async Task StaleDataAndSourceDown_ShouldSkipDetection()
    {
        using var db = CreateDb();
        var audit = new StubAuditService();
        var svc = new WeatherAlertService(db, CreateConfig(), audit, NullLogger<WeatherAlertService>.Instance);

        db.WeatherAlertRules.Add(new WeatherAlertRule { Mode = "AutoSend", MaxDataAgeMinutes = 60 });
        db.DistrictRiskSnapshots.Add(new DistrictRiskSnapshot
        {
            District = "Galle",
            RiskLevel = "High",
            Rainfall24hMm = 120,
            IsStale = true,
            DataUpdatedAtUtc = DateTime.UtcNow.AddHours(-3)
        });
        await db.SaveChangesAsync();

        var created = await svc.EvaluateAfterRiskRefreshAsync();
        Assert.Equal(0, created);
        Assert.Empty(db.AutomatedAlerts);
    }

    [Fact]
    public async Task CooldownAndDedupe_ShouldNeverCreateDuplicateInSameWindow()
    {
        using var db = CreateDb();
        var audit = new StubAuditService();
        var svc = new WeatherAlertService(db, CreateConfig(), audit, NullLogger<WeatherAlertService>.Instance);

        db.WeatherAlertRules.Add(new WeatherAlertRule { Mode = "DraftForApproval", CooldownHours = 12 });
        db.DistrictRiskSnapshots.Add(new DistrictRiskSnapshot
        {
            District = "Kalutara",
            RiskLevel = "High",
            Rainfall24hMm = 110,
            IsStale = false,
            DataUpdatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var first = await svc.EvaluateAfterRiskRefreshAsync();
        var second = await svc.EvaluateAfterRiskRefreshAsync();
        Assert.Equal(1, first);
        Assert.Equal(0, second);
        Assert.Single(db.AutomatedAlerts);
    }

    [Fact]
    public async Task KillSwitchAndDraftMode_ShouldRespectGovernanceAndAudit()
    {
        using var db = CreateDb();
        var audit = new StubAuditService();
        var svc = new WeatherAlertService(db, CreateConfig(), audit, NullLogger<WeatherAlertService>.Instance);

        db.WeatherAlertRules.Add(new WeatherAlertRule { Mode = "Off" });
        db.DistrictRiskSnapshots.Add(new DistrictRiskSnapshot
        {
            District = "Matara",
            RiskLevel = "Severe",
            Rainfall24hMm = 180,
            DataUpdatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        Assert.Equal(0, await svc.EvaluateAfterRiskRefreshAsync());

        await svc.UpdateRuleAsync(new UpdateWeatherAlertRuleDto(
            "DraftForApproval", null, null, null, null, null, null, null, null, null, null, null, null, "Enable draft review"),
            "admin-1", "SystemAdmin");

        Assert.Equal(1, await svc.EvaluateAfterRiskRefreshAsync());
        var alert = await db.AutomatedAlerts.SingleAsync();
        Assert.Equal("Draft", alert.Status);
        Assert.Equal("template", alert.ModelUsed);
        Assert.Contains(WeatherAlertLogic.MandatoryDisclaimer, alert.MessageEn);
        Assert.Contains("DetectThresholdCrossing", audit.Entries.Select(e => e.Action));
    }

    [Fact]
    public async Task OptInDistrictFiltering_Unsubscribe_AndDailyLimitQueueing_ShouldWork()
    {
        using var db = CreateDb();
        var audit = new StubAuditService();
        var cfg = CreateConfig(new Dictionary<string, string?> { ["Email:DailyLimit"] = "1" });
        var svc = new WeatherAlertService(db, cfg, audit, NullLogger<WeatherAlertService>.Instance);

        db.WeatherAlertRules.Add(new WeatherAlertRule { Mode = "DraftForApproval" });
        db.Users.AddRange(
            new ApplicationUser { Id = "u1", Email = "a@test.lk", EmailConfirmed = true, IsEnabled = true, AlertOptIn = true, District = "Colombo", PreferredLanguage = "en" },
            new ApplicationUser { Id = "u2", Email = "b@test.lk", EmailConfirmed = true, IsEnabled = true, AlertOptIn = true, District = "Colombo", PreferredLanguage = "si" },
            new ApplicationUser { Id = "u3", Email = "c@test.lk", EmailConfirmed = true, IsEnabled = true, AlertOptIn = false, District = "Colombo" },
            new ApplicationUser { Id = "u4", Email = "d@test.lk", EmailConfirmed = true, IsEnabled = true, AlertOptIn = true, District = "Kandy" }
        );
        db.DistrictRiskSnapshots.Add(new DistrictRiskSnapshot
        {
            District = "Colombo",
            RiskLevel = "High",
            Rainfall24hMm = 100,
            DataUpdatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        await svc.EvaluateAfterRiskRefreshAsync();
        var alert = await db.AutomatedAlerts.SingleAsync();
        var approveRes = await svc.ApproveAndSendAsync(alert.Id, "staff-1", "EmergencyCoordinator", "Verified radar");
        Assert.True(approveRes.IsSuccess);
        Assert.Equal(2, approveRes.Value!.RecipientCount); // Only u1 and u2

        var outboxes = await db.NotificationOutboxes.OrderBy(o => o.NextAttemptAt).ToListAsync();
        Assert.Equal(2, outboxes.Count);
        Assert.True(outboxes[1].NextAttemptAt > DateTime.UtcNow.AddHours(1)); // Overflow queued for tomorrow

        var emailHealth = await db.ServiceHealths.FirstOrDefaultAsync(s => s.ServiceName == "email");
        Assert.NotNull(emailHealth);
        Assert.Equal("Degraded", emailHealth!.Status);

        // Signed unsubscribe
        var token = UnsubscribeTokenHelper.CreateToken("u1", "test-signing-key-32-chars-minimum-length");
        var unsubRes = await svc.UnsubscribeByTokenAsync(token);
        Assert.True(unsubRes.IsSuccess);
        Assert.False((await db.Users.FirstAsync(u => u.Id == "u1")).AlertOptIn);

        // Retract sends correction
        var retractRes = await svc.RetractAsync(alert.Id, "staff-1", "EmergencyCoordinator", "Sensor recalibrated");
        Assert.True(retractRes.IsSuccess);
        Assert.Equal("Retracted", retractRes.Value!.Status);
        Assert.Contains("Retract", audit.Entries.Select(e => e.Action));
    }
}

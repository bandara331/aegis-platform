using System.Net;
using Aegis.Domain.Entities;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Aegis.UnitTests;

public class AdvancedAiPartCTests
{
    private sealed class StubAuditService : IAuditService
    {
        public Task<AuditLogEntry> AppendAsync(string entityName, string entityId, string action, string actorId, string actorRole, object details, CancellationToken cancellationToken = default)
            => Task.FromResult(new AuditLogEntry { EntityName = entityName, EntityId = entityId, Action = action, ActorId = actorId, ActorRole = actorRole });
        public Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<(bool, long?, string?)>((true, null, null));
    }

    [Fact]
    public void StockForecastMath_Computes_Ewma_Range_With_Fixed_Inputs()
    {
        var t0 = new DateTime(2026, 11, 18, 10, 0, 0, DateTimeKind.Utc);
        var allocs = new List<(DateTime, int)>
        {
            (t0, 10),
            (t0.AddHours(1), 10), // 10/h
            (t0.AddHours(2), 10), // 10/h
            (t0.AddHours(3), 10), // 10/h
        };
        var opts = new StockForecastOptions(MinDataPoints: 3, EwmaAlpha: 0.4, HighRainfallThresholdMm: 25.0, HighRainfallMultiplier: 1.35, AlertThresholdHours: 12.0);

        var res = StockForecastMath.Compute(90, allocs, rainfall24hMm: 5.0, opts);

        Assert.True(res.HasEnoughData);
        Assert.Equal(10.0, res.EwmaHourlyRate);
        Assert.Equal(1.0, res.RainfallMultiplier);
        Assert.Equal(9.0, res.EstimatedHours);
        Assert.True(res.AlertTriggered);
        Assert.Contains("runs out in about 9 h", res.DisplayText);
    }

    [Fact]
    public void StockForecastMath_Returns_NotEnoughData_When_Below_Minimum_Points()
    {
        var t0 = new DateTime(2026, 11, 18, 10, 0, 0, DateTimeKind.Utc);
        var allocs = new List<(DateTime, int)> { (t0, 10), (t0.AddHours(1), 10) };
        var opts = new StockForecastOptions(MinDataPoints: 3);

        var res = StockForecastMath.Compute(100, allocs, 0.0, opts);

        Assert.False(res.HasEnoughData);
        Assert.Null(res.EstimatedHours);
        Assert.Equal("not enough data", res.DisplayText);
    }

    [Fact]
    public void StockForecastMath_Applies_Rainfall_Multiplier_When_Rainfall_High()
    {
        var t0 = new DateTime(2026, 11, 18, 10, 0, 0, DateTimeKind.Utc);
        var allocs = new List<(DateTime, int)>
        {
            (t0, 10),
            (t0.AddHours(1), 10),
            (t0.AddHours(2), 10)
        };
        var opts = new StockForecastOptions(MinDataPoints: 3, EwmaAlpha: 0.4, HighRainfallThresholdMm: 25.0, HighRainfallMultiplier: 1.5, AlertThresholdHours: 12.0);

        var res = StockForecastMath.Compute(150, allocs, rainfall24hMm: 40.0, opts);

        Assert.True(res.HasEnoughData);
        Assert.Equal(1.5, res.RainfallMultiplier);
        Assert.Equal(15.0, res.EwmaHourlyRate);
        Assert.Equal(10.0, res.EstimatedHours);
    }

    [Fact]
    public void DistrictRiskMath_Computes_Risk_Levels_And_Contributing_Factors()
    {
        var opts = new DistrictRiskOptions();

        var low = DistrictRiskMath.Compute(5, 10, 20, "None", 1, opts, "Open-Meteo Live");
        Assert.Equal("Low", low.RiskLevel);
        Assert.Equal(5, low.Factors.Count);

        var severe = DistrictRiskMath.Compute(95, 180, 450, "Critical", 18, opts, "Open-Meteo Live");
        Assert.Equal("Severe", severe.RiskLevel);
        Assert.True(severe.RiskScore >= opts.SevereThreshold);
        Assert.Contains(severe.Factors, f => f.Name == "24h Rainfall" && f.Source == "Open-Meteo Live");
        Assert.Contains(severe.Factors, f => f.Name == "Official NBRO/DMC Alert" && f.Value == "Critical");
    }

    [Fact]
    public async Task DistrictRisk_Marks_Stale_When_Data_Older_Than_Threshold()
    {
        var dbOpts = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new AegisDbContext(dbOpts);

        db.DistrictRiskSnapshots.Add(new DistrictRiskSnapshot
        {
            District = "Ratnapura",
            Latitude = 6.6828,
            Longitude = 80.3992,
            RiskLevel = "High",
            RiskScore = 62.0,
            FactorsJson = "[]",
            DataUpdatedAtUtc = DateTime.UtcNow.AddHours(-4), // older than default 90 min
            ComputedAtUtc = DateTime.UtcNow.AddHours(-4),
            IsStale = false,
            AdvisoryNotice = "advisory, not official"
        });
        await db.SaveChangesAsync();

        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Ai:Risk:StaleAfterMinutes"] = "90" })
            .Build();

        var svc = new PredictionService(
            db,
            new StubAuditService(),
            new HttpClient(),
            cfg,
            NullLogger<PredictionService>.Instance);

        var risk = await svc.GetDistrictRiskAsync();
        Assert.True(risk.AnyStale);
        Assert.Single(risk.Districts);
        Assert.True(risk.Districts[0].IsStale);
        Assert.Equal("advisory, not official", risk.AdvisoryNotice);
    }
}

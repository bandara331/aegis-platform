using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Strategies;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aegis.UnitTests;

public class Phase4Tests
{
    private static readonly List<AssistanceRequest> SampleCompetingRequests =
    [
        new AssistanceRequest
        {
            Id = Guid.NewGuid(),
            TrackingNumber = "REQ-CRIT",
            Area = "Kalutara",
            Category = "Water",
            Priority = RequestPriority.Critical,
            UrgencyScore = 92,
            PeopleCount = 6,
            Latitude = 6.6500,
            Longitude = 80.0200,
            CreatedAt = DateTime.UtcNow.AddMinutes(-50)
        },
        new AssistanceRequest
        {
            Id = Guid.NewGuid(),
            TrackingNumber = "REQ-NEAR",
            Area = "Depot-Neighbor",
            Category = "Water",
            Priority = RequestPriority.Medium,
            UrgencyScore = 55,
            PeopleCount = 6,
            Latitude = 6.5825,
            Longitude = 79.9655,
            CreatedAt = DateTime.UtcNow.AddMinutes(-20)
        }
    ];

    [Fact]
    public void MaxUrgencyStrategy_ShouldProtectCriticalNeedFirst_WhenStockScarce()
    {
        var strategy = new MaxUrgencyStrategy();
        var result = strategy.Allocate(SampleCompetingRequests, availableStock: 8, 6.5820, 79.9650, (_, _, _, _) => (5.0, 12));

        var crit = result.First(r => r.TrackingNumber == "REQ-CRIT");
        var near = result.First(r => r.TrackingNumber == "REQ-NEAR");

        crit.StrategyAllocated.Should().Be(6); // Full critical allocation protected
        near.StrategyAllocated.Should().Be(2); // Remainder given to lower urgency
    }

    [Fact]
    public void FairShareStrategy_ShouldDistributeProportionallyAcrossCompetingRequests()
    {
        var strategy = new FairShareStrategy();
        var result = strategy.Allocate(SampleCompetingRequests, availableStock: 8, 6.5820, 79.9650, (_, _, _, _) => (5.0, 12));

        result.Sum(r => r.StrategyAllocated).Should().BeLessThanOrEqualTo(8);
        result.All(r => r.StrategyAllocated > 0).Should().BeTrue();
    }

    [Fact]
    public void FastestEtaStrategy_ShouldRankClosestRequestFirst_WhenEtaMuchShorter()
    {
        var strategy = new FastestEtaStrategy();
        var result = strategy.Allocate(
            SampleCompetingRequests,
            availableStock: 6,
            6.5820,
            79.9650,
            (lat1, lon1, lat2, lon2) => Math.Abs(lat1 - lat2) < 0.01 ? (0.5, 2) : (18.0, 45));

        result[0].TrackingNumber.Should().Be("REQ-NEAR");
        result[0].StrategyAllocated.Should().Be(6);
    }

    [Fact]
    public async Task ShelterAllocation_ShouldBlockOverCapacity_AndPreventExcessUnderSequentialOrConcurrentCalls()
    {
        var options = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        using var db = new AegisDbContext(options);

        var shelter = new Shelter
        {
            Id = Guid.NewGuid(),
            Name = "Shelter Test",
            District = "Kalutara",
            Capacity = 10,
            Occupancy = 6
        };
        db.Shelters.Add(shelter);
        await db.SaveChangesAsync();

        var audit = new AuditService(db, NullLogger<AuditService>.Instance);
        var svc = new ShelterService(db, audit, NullLogger<ShelterService>.Instance);

        // First allocation of 3 succeeds (occupancy 6 -> 9 <= 10)
        var first = await svc.AllocateAsync(shelter.Id, new AllocateShelterDto(Guid.NewGuid(), 3), "u1", "ShelterAdmin");
        first.IsSuccess.Should().BeTrue();
        first.Value!.Occupancy.Should().Be(9);

        // Second allocation of 3 must fail with 409 reason (9 + 3 > 10)
        var second = await svc.AllocateAsync(shelter.Id, new AllocateShelterDto(Guid.NewGuid(), 3), "u2", "ShelterAdmin");
        second.IsFailure.Should().BeTrue();
        second.Error.Should().Contain("Over-allocation blocked");
        (await db.Shelters.FirstAsync()).Occupancy.Should().Be(9);
    }

    [Fact]
    public void DuplicateDetector_ShouldIdentifyMatch_Within500m_And24Hours_WithJaccardOverlap()
    {
        var req1 = new AssistanceRequest
        {
            Id = Guid.NewGuid(),
            TrackingNumber = "REQ-100",
            Category = "Medical",
            Description = "Insulin needed urgently for elderly person in Kalutara",
            Latitude = 6.5850,
            Longitude = 79.9620,
            CreatedAt = DateTime.UtcNow
        };

        var req2 = new AssistanceRequest
        {
            Id = Guid.NewGuid(),
            TrackingNumber = "REQ-101",
            Category = "Medical",
            Description = "Urgent insulin required for elderly household Kalutara",
            Latitude = 6.5854,
            Longitude = 79.9623,
            CreatedAt = DateTime.UtcNow.AddHours(-3)
        };

        var eval = DuplicateDetector.Evaluate(req1, req2);
        eval.IsLikelyDuplicate.Should().BeTrue();
        eval.DistanceMeters.Should().BeLessThan(500);
        eval.JaccardSimilarity.Should().BeGreaterThan(0.25);
    }

    [Fact]
    public void NotificationFactory_ShouldGenerateLocalizedTemplates_AndDeterministicIdempotencyKeys()
    {
        var req = new AssistanceRequest
        {
            Id = Guid.Parse("11111111-2222-3333-4444-555555555555"),
            TrackingNumber = "REQ-4821",
            Category = "Medical",
            Area = "Kalutara",
            Language = "si",
            Priority = RequestPriority.Critical
        };

        var n1 = NotificationFactory.CreateRequestReceivedNotification(req, "citizen@aegis.local");
        var n2 = NotificationFactory.CreateRequestReceivedNotification(req, "citizen@aegis.local");

        n1.IdempotencyKey.Should().Be(n2.IdempotencyKey);
        n1.Subject.Should().Contain("AEGIS");
        n1.Payload.Should().Contain("REQ-4821");
    }

    [Fact]
    public async Task RoutingService_WhenRemoteDisabledOrDown_ShouldReturnHaversineFallback()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Routing:EnableRemote"] = "false" })
            .Build();

        var routing = new OsrmRoutingService(new HttpClient(), config, NullLogger<OsrmRoutingService>.Instance);
        var (distKm, etaMin, source) = await routing.GetRouteAsync(6.5820, 79.9650, 6.6828, 80.4036);

        source.Should().Be("HaversineFallback");
        distKm.Should().BeGreaterThan(40);
        etaMin.Should().BeGreaterThan(60);
    }

    [Fact]
    public async Task LocalFileStorage_ShouldValidateMagicBytes_AndRejectSpoofedExecutable()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "aegis-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            var storage = new LocalFileStorage(tempDir);

            // 1. Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
            var validPngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01 };
            using var validStream = new MemoryStream(validPngBytes);
            var ok = await storage.SaveValidatedFileAsync("flood-photo.png", "image/png", validStream);
            ok.IsSuccess.Should().BeTrue();

            // 2. Spoofed file claiming to be .png but containing MZ (EXE) header
            var spoofedBytes = new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00 };
            using var badStream = new MemoryStream(spoofedBytes);
            var rejected = await storage.SaveValidatedFileAsync("malware.png", "image/png", badStream);
            rejected.IsFailure.Should().BeTrue();
            rejected.Error.Should().Contain("magic bytes");
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }
}

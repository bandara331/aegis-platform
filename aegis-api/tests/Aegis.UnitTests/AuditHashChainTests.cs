using Aegis.Domain.Entities;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aegis.UnitTests;

public class AuditHashChainTests
{
    private AegisDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AegisDbContext(options);
    }

    [Fact]
    public async Task AppendAsync_ShouldCreateCryptographicallyChainedEntries()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var auditService = new AuditService(context, NullLogger<AuditService>.Instance);

        // Act
        var entry1 = await auditService.AppendAsync("AssistanceRequest", "REQ-101", "Create", "user-1", "Citizen", new { urgency = 5 });
        var entry2 = await auditService.AppendAsync("AssistanceRequest", "REQ-101", "Review", "user-2", "EmergencyCoordinator", new { approved = true });

        // Assert
        entry1.SequenceNumber.Should().Be(1);
        entry1.PreviousHash.Should().Be("GENESIS_AEGIS_CHAIN_INITIAL_STATE");
        entry1.CurrentHash.Should().NotBeNullOrWhiteSpace();

        entry2.SequenceNumber.Should().Be(2);
        entry2.PreviousHash.Should().Be(entry1.CurrentHash);
        entry2.CurrentHash.Should().NotBeNullOrWhiteSpace();

        var (isValid, brokenSeq, error) = await auditService.VerifyChainAsync();
        isValid.Should().BeTrue();
        brokenSeq.Should().BeNull();
        error.Should().BeNull();
    }

    [Fact]
    public async Task VerifyChainAsync_WhenEntryTampered_ShouldDetectTamperAndIdentifySequence()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var auditService = new AuditService(context, NullLogger<AuditService>.Instance);

        await auditService.AppendAsync("AssistanceRequest", "REQ-101", "Create", "user-1", "Citizen", new { text = "Original" });
        var entry2 = await auditService.AppendAsync("AssistanceRequest", "REQ-101", "Decision", "user-2", "EmergencyCoordinator", new { action = "Approve" });
        await auditService.AppendAsync("AssistanceRequest", "REQ-101", "Dispatch", "user-3", "LogisticsManager", new { qty = 2 });

        // Act: simulate malicious database tampering of entry 2 details
        entry2.DetailsJson = "{\"action\":\"Reject\",\"tampered\":true}";
        await context.SaveChangesAsync();

        // Assert
        var (isValid, brokenSeq, error) = await auditService.VerifyChainAsync();
        isValid.Should().BeFalse();
        brokenSeq.Should().Be(2);
        error.Should().Contain("Current hash corrupted at sequence 2");
    }

    [Fact]
    public async Task VerifyChainAsync_WhenPreviousHashTampered_ShouldDetectBrokenLink()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var auditService = new AuditService(context, NullLogger<AuditService>.Instance);

        await auditService.AppendAsync("Resource", "RES-1", "Create", "admin", "SystemAdmin", new { qty = 10 });
        var entry2 = await auditService.AppendAsync("Resource", "RES-1", "Allocate", "logistics", "LogisticsManager", new { qty = 5 });

        // Act: corrupt the previous hash pointer
        entry2.PreviousHash = "0000000000000000000000000000000000000000000000000000000000000000";
        await context.SaveChangesAsync();

        // Assert
        var (isValid, brokenSeq, error) = await auditService.VerifyChainAsync();
        isValid.Should().BeFalse();
        brokenSeq.Should().Be(2);
        error.Should().Contain("Previous hash mismatch at sequence 2");
    }
}

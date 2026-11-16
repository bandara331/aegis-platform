using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using FluentAssertions;

namespace Aegis.UnitTests;

public class DomainRulesTests
{
    [Fact]
    public void Result_WhenSuccessful_ShouldHoldValue()
    {
        // Act
        var result = Result<int>.Success(42);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Value.Should().Be(42);
        result.Error.Should().BeEmpty();
    }

    [Fact]
    public void Result_WhenFailed_ShouldHoldErrorMessage()
    {
        // Act
        var result = Result<int>.Failure("Allocation failed: Shelter is full.");

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be("Allocation failed: Shelter is full.");
    }

    [Fact]
    public void AssistanceRequest_ShouldInitializeWithDefaults()
    {
        // Act
        var request = new AssistanceRequest
        {
            TrackingNumber = "REQ-9999",
            Category = "Medical",
            Area = "Kalutara"
        };

        // Assert
        request.Status.Should().Be(RequestStatus.Submitted);
        request.Priority.Should().Be(RequestPriority.Medium);
        request.ConsentGiven.Should().BeTrue();
        request.Histories.Should().NotBeNull();
        request.Recommendations.Should().NotBeNull();
    }

    [Fact]
    public void Shelter_OccupancyConstraintLogic_ShouldDetectOverCapacity()
    {
        // Arrange
        var shelter = new Shelter
        {
            Name = "Shelter A",
            Capacity = 100,
            Occupancy = 95
        };

        // Act & Assert
        var canAllocate10 = (shelter.Occupancy + 10) <= shelter.Capacity;
        var canAllocate5 = (shelter.Occupancy + 5) <= shelter.Capacity;

        canAllocate10.Should().BeFalse();
        canAllocate5.Should().BeTrue();
    }
}

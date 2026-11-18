using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aegis.UnitTests;

public class CitizenRequestFlowTests
{
    private static AegisDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static RequestService CreateRequestService(AegisDbContext db)
    {
        var ai = new RuleBasedAiProvider(db, NullLogger<RuleBasedAiProvider>.Instance);
        var audit = new AuditService(db, NullLogger<AuditService>.Instance);
        return new RequestService(db, ai, audit, NullLogger<RequestService>.Instance);
    }

    [Fact]
    public async Task CreateRequest_GeneratesAegReferenceNumber_QueuesReceivedEmail_AndHonoursIdempotencyKey()
    {
        using var db = CreateDb();
        var svc = CreateRequestService(db);

        var dto = new CreateRequestDto(
            CrisisId: null,
            Category: "Water",
            Description: "Clean drinking water needed for 5 family members including an infant",
            Language: "en",
            Area: "Colombo",
            Latitude: 6.9271,
            Longitude: 79.8612,
            SelfReportedUrgency: 4,
            PeopleCount: 5,
            ConsentGiven: true,
            VulnerableFlags: "Infants,Elderly",
            ContactMobile: "0771234567",
            ContactEmail: "citizen@example.lk"
        );

        var created1 = await svc.CreateRequestAsync(dto, "cit-1", "idem-key-100");
        var created2 = await svc.CreateRequestAsync(dto, "cit-1", "idem-key-100");

        created1.Id.Should().Be(created2.Id);
        created1.TrackingNumber.Should().StartWith($"AEG-{DateTime.UtcNow.Year}-000001");
        created1.VulnerableFlags.Should().Be("Infants,Elderly");
        created1.CanCancel.Should().BeTrue();
        created1.Timeline.Should().NotBeNullOrEmpty();

        var outbox = await db.NotificationOutboxes.SingleAsync();
        outbox.Recipient.Should().Be("citizen@example.lk");
        outbox.Payload.Should().Contain(created1.TrackingNumber);
        outbox.Payload.Should().Contain($"/my-requests/{created1.Id}");
    }

    [Fact]
    public async Task CheckCitizenDuplicate_WarnsWhenSameCitizenHasOpenRequestNearby_AndAllowsWhenConfirmed()
    {
        using var db = CreateDb();
        var svc = CreateRequestService(db);

        var firstDto = new CreateRequestDto(
            CrisisId: null,
            Category: "Medical",
            Description: "Need insulin and blood pressure medication urgently",
            Language: "en",
            Area: "Galle",
            Latitude: 6.0535,
            Longitude: 80.2210,
            SelfReportedUrgency: 5,
            PeopleCount: 2,
            ConsentGiven: true,
            VulnerableFlags: "MedicalUrgent",
            ContactMobile: "0771112222",
            ContactEmail: "cit@example.lk"
        );

        var first = await svc.CreateRequestAsync(firstDto, "cit-dup", null);

        // Nearby second request from same citizen without ConfirmDuplicate
        var secondDto = firstDto with { Latitude = 6.0538, Longitude = 80.2212, ConfirmDuplicate = false };
        var warning = await svc.CheckCitizenDuplicateAsync(secondDto, "cit-dup");

        warning.Should().NotBeNull();
        warning!.ExistingRequestId.Should().Be(first.Id);
        warning.ExistingTrackingNumber.Should().Be(first.TrackingNumber);

        // Confirmed duplicate bypasses warning
        var confirmedDto = secondDto with { ConfirmDuplicate = true };
        var warningAfterConfirm = await svc.CheckCitizenDuplicateAsync(confirmedDto, "cit-dup");
        warningAfterConfirm.Should().BeNull();
    }

    [Fact]
    public async Task CancelAndFeedbackRules_EnforceLifecycleConstraints()
    {
        using var db = CreateDb();
        var svc = CreateRequestService(db);

        var dto = new CreateRequestDto(
            null, "Food", "Dry rations needed for 4 people", "si", "Kandy",
            7.2906, 80.6337, 3, 4, true, "Children", "0712345678", "kandy@example.lk");

        var created = await svc.CreateRequestAsync(dto, "cit-kandy", null);

        // Cannot submit feedback before completion
        var earlyFeedback = await svc.SubmitFeedbackAsync(created.Id, new SubmitFeedbackDto(5, "Thank you"), "cit-kandy");
        earlyFeedback.IsFailure.Should().BeTrue();

        // Staff transitions request: Approved -> Assigned -> On the way -> Completed
        (await svc.UpdateStatusAsync(created.Id, new UpdateRequestStatusDto("Approved", "Approved by coordinator"), "staff-1", "EmergencyCoordinator")).IsSuccess.Should().BeTrue();
        (await svc.UpdateStatusAsync(created.Id, new UpdateRequestStatusDto("Assigned", "Team Alpha assigned"), "staff-1", "EmergencyCoordinator")).IsSuccess.Should().BeTrue();

        // Once Assigned, citizen can no longer cancel
        var cancelAfterAssigned = await svc.CancelRequestAsync(created.Id, "No longer needed", "cit-kandy");
        cancelAfterAssigned.IsFailure.Should().BeTrue();

        (await svc.UpdateStatusAsync(created.Id, new UpdateRequestStatusDto("On the way", "Vehicle dispatched"), "staff-1", "LogisticsManager")).IsSuccess.Should().BeTrue();
        var completed = await svc.UpdateStatusAsync(created.Id, new UpdateRequestStatusDto("Completed", "Delivered to household"), "staff-1", "CaseManager");
        completed.IsSuccess.Should().BeTrue();
        completed.Value!.CanSubmitFeedback.Should().BeTrue();

        // Now citizen can submit feedback
        var feedback = await svc.SubmitFeedbackAsync(created.Id, new SubmitFeedbackDto(5, "Fast relief delivery"), "cit-kandy");
        feedback.IsSuccess.Should().BeTrue();
        feedback.Value!.FeedbackRating.Should().Be(5);
        feedback.Value.CanSubmitFeedback.Should().BeFalse();
    }

    [Theory]
    [InlineData("en")]
    [InlineData("si")]
    [InlineData("ta")]
    public void AllSixRequestEmails_IncludeReferenceNumber_AndMyRequestsLink_InAllLanguages(string lang)
    {
        var req = new AssistanceRequest
        {
            Id = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            TrackingNumber = "AEG-2026-000123",
            Category = "Medical",
            Area = "Kalutara",
            Language = lang,
            Priority = RequestPriority.Critical,
            Status = RequestStatus.NeedsReview
        };

        var expectedLink = $"/my-requests/{req.Id}";

        var emails = new[]
        {
            NotificationFactory.CreateRequestReceivedNotification(req, "c@aegis.lk"),
            NotificationFactory.CreateStatusChangedNotification(req, "On the way", "Dispatched", "c@aegis.lk"),
            NotificationFactory.CreateRequestAssignedNotification(req, "Team Bravo", "c@aegis.lk"),
            NotificationFactory.CreateRequestApprovedNotification(req, "c@aegis.lk"),
            NotificationFactory.CreateRequestRejectedNotification(req, "Duplicate of verified household request", "c@aegis.lk"),
            NotificationFactory.CreateRequestCompletedNotification(req, "c@aegis.lk")
        };

        foreach (var email in emails)
        {
            email.Subject.Should().Contain("AEG-2026-000123");
            email.Payload.Should().Contain("AEG-2026-000123");
            email.Payload.Should().Contain(expectedLink);
        }
    }
}

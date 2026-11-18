using System.Net;
using System.Security.Claims;
using Aegis.Api.Controllers;
using Aegis.Application.DTOs;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Aegis.UnitTests;

public class AdvancedAiPartDTests
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

    private static AegisDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AegisDbContext(opts);
    }

    private static IConfiguration BuildConfig(int maxStops = 50, int maxVehicles = 15) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Ai:Dispatch:MaxStops"] = maxStops.ToString(),
                ["Ai:Dispatch:MaxVehicles"] = maxVehicles.ToString(),
                ["Ai:Dispatch:TimeLimitSeconds"] = "5"
            })
            .Build();

    [Fact]
    public async Task OrTools_Respects_Capacity_Serves_Critical_First_And_Marks_Haversine_Fallback()
    {
        await using var db = CreateDb();
        var vol = new Volunteer { FullName = "Driver Nimal", District = "Colombo", Skills = "Medical" };
        db.Volunteers.Add(vol);

        var v1 = new Vehicle
        {
            Name = "Colombo Van 1",
            VehicleType = "Van",
            Capacity = 4, // can only carry 4 people total
            CurrentLatitude = 6.9271,
            CurrentLongitude = 79.8612,
            AssignedVolunteerId = vol.Id,
            AssignedDriverName = "Driver Nimal",
            Availability = "Available"
        };
        db.Vehicles.Add(v1);

        var criticalReq = new AssistanceRequest
        {
            TrackingNumber = "AEG-CRIT",
            Category = "Medical",
            Area = "Colombo",
            Latitude = 6.9300,
            Longitude = 79.8650,
            PeopleCount = 3,
            Priority = RequestPriority.Critical,
            Status = RequestStatus.Approved,
            Description = "Critical patient"
        };
        var lowReq = new AssistanceRequest
        {
            TrackingNumber = "AEG-LOW",
            Category = "Food",
            Area = "Colombo",
            Latitude = 6.9350,
            Longitude = 79.8700,
            PeopleCount = 3, // 3 + 3 > 4 capacity, so Low must be dropped!
            Priority = RequestPriority.Low,
            Status = RequestStatus.Approved,
            Description = "Dry rations"
        };
        db.AssistanceRequests.AddRange(criticalReq, lowReq);
        await db.SaveChangesAsync();

        var optimiser = new OrToolsDispatchOptimiser(
            db,
            new HttpClient(),
            BuildConfig(),
            NullLogger<OrToolsDispatchOptimiser>.Instance);

        var result = await optimiser.OptimizeAsync(new DispatchPlanRequestDto(), "coord-1");
        Assert.True(result.IsSuccess);
        var plan = result.Value!;

        Assert.Equal("Preview", plan.Status);
        Assert.True(plan.IsEstimated);
        Assert.Equal("Haversine (estimated)", plan.RoutingSource);
        Assert.Single(plan.Routes);
        Assert.Single(plan.Routes[0].Stops);
        Assert.Equal("AEG-CRIT", plan.Routes[0].Stops[0].TrackingNumber);
        Assert.True(plan.Routes[0].TotalLoad <= 4);

        Assert.Single(plan.Unserved);
        Assert.Equal("AEG-LOW", plan.Unserved[0].TrackingNumber);
        Assert.False(string.IsNullOrWhiteSpace(plan.Unserved[0].Reason));

        // Preview MUST NOT create VolunteerAssignments or change request status
        Assert.Empty(await db.VolunteerAssignments.ToListAsync());
        Assert.Equal(RequestStatus.Approved, (await db.AssistanceRequests.FindAsync(criticalReq.Id))!.Status);
    }

    [Fact]
    public async Task OrTools_Rejects_Inputs_Exceeding_Size_Caps()
    {
        await using var db = CreateDb();
        db.Vehicles.Add(new Vehicle { Name = "V1", Capacity = 10, Availability = "Available" });
        for (int i = 0; i < 4; i++)
        {
            db.AssistanceRequests.Add(new AssistanceRequest
            {
                TrackingNumber = $"AEG-{i}",
                Category = "Water",
                Area = "Colombo",
                Status = RequestStatus.Approved,
                Description = "Water"
            });
        }
        await db.SaveChangesAsync();

        var optimiser = new OrToolsDispatchOptimiser(
            db,
            new HttpClient(),
            BuildConfig(maxStops: 2, maxVehicles: 15),
            NullLogger<OrToolsDispatchOptimiser>.Instance);

        var res = await optimiser.OptimizeAsync(new DispatchPlanRequestDto(), "coord-1");
        Assert.True(res.IsFailure);
        Assert.Contains("Too many stops", res.Error);
    }

    [Fact]
    public async Task Approval_Requires_SecondApprover_For_Critical_And_Creates_Assignments_Only_After_Approval()
    {
        await using var db = CreateDb();
        var vol = new Volunteer { FullName = "Driver Kamal", District = "Galle", Skills = "Rescue" };
        db.Volunteers.Add(vol);
        var v1 = new Vehicle { Name = "Galle Boat", VehicleType = "Boat", Capacity = 5, CurrentLatitude = 6.05, CurrentLongitude = 80.22, AssignedVolunteerId = vol.Id, Availability = "Available" };
        db.Vehicles.Add(v1);
        var req = new AssistanceRequest { TrackingNumber = "AEG-APPR", Category = "Medical", Area = "Galle", Latitude = 6.06, Longitude = 80.23, PeopleCount = 2, Priority = RequestPriority.Critical, Status = RequestStatus.Approved, ContactEmail = "cit@example.lk", Description = "Rescue" };
        db.AssistanceRequests.Add(req);
        await db.SaveChangesAsync();

        var audit = new StubAuditService();
        var optimiser = new OrToolsDispatchOptimiser(db, new HttpClient(), BuildConfig(), NullLogger<OrToolsDispatchOptimiser>.Instance);
        var planRes = await optimiser.OptimizeAsync(new DispatchPlanRequestDto(), "coord-1");
        var plan = planRes.Value!;
        Assert.True(plan.RequiresSecondApprover);

        var controller = new DispatchController(db, optimiser, audit);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "coord-1") }, "test"))
            }
        };

        // Missing second approver must fail
        var badApprove = await controller.ApprovePlan(plan.Id, new ApproveDispatchPlanDto(null), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badApprove);
        Assert.Empty(await db.VolunteerAssignments.ToListAsync());

        // With second approver succeeds and creates assignments + outbox + audit
        var okApprove = await controller.ApprovePlan(plan.Id, new ApproveDispatchPlanDto("coord-2"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(okApprove);
        Assert.Single(await db.VolunteerAssignments.ToListAsync());
        Assert.Single(await db.NotificationOutboxes.ToListAsync());
        Assert.Equal(RequestStatus.Assigned, (await db.AssistanceRequests.FindAsync(req.Id))!.Status);
        Assert.Contains("DispatchPlanApproved", audit.Actions);
    }
}

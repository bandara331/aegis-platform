using System.Security.Claims;
using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Api.Controllers;

[ApiController]
[Route("api/v1/dispatch")]
[Authorize(Policy = "StaffOnly")]
public class DispatchController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IDispatchOptimiser _optimiser;
    private readonly IAuditService _audit;

    public DispatchController(AegisDbContext context, IDispatchOptimiser optimiser, IAuditService audit)
    {
        _context = context;
        _optimiser = optimiser;
        _audit = audit;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.Identity?.Name ?? "staff";

    [HttpGet("vehicles")]
    public async Task<IActionResult> ListVehicles(CancellationToken ct)
    {
        var list = await _context.Vehicles.AsNoTracking()
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new VehicleDto(
                v.Id, v.Name, v.VehicleType, v.Capacity,
                v.CurrentLatitude, v.CurrentLongitude,
                v.AssignedVolunteerId, v.AssignedDriverName,
                v.Availability, v.Skills))
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("vehicles")]
    public async Task<IActionResult> CreateVehicle([FromBody] CreateVehicleDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || dto.Capacity < 1)
            return BadRequest(new { message = "Vehicle name and capacity >= 1 are required." });

        var v = new Vehicle
        {
            Name = dto.Name.Trim(),
            VehicleType = string.IsNullOrWhiteSpace(dto.VehicleType) ? "Van" : dto.VehicleType.Trim(),
            Capacity = dto.Capacity,
            CurrentLatitude = dto.CurrentLatitude,
            CurrentLongitude = dto.CurrentLongitude,
            AssignedVolunteerId = dto.AssignedVolunteerId,
            AssignedDriverName = dto.AssignedDriverName?.Trim(),
            Availability = string.IsNullOrWhiteSpace(dto.Availability) ? "Available" : dto.Availability.Trim(),
            Skills = dto.Skills ?? string.Empty
        };

        _context.Vehicles.Add(v);
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("Vehicle", v.Id.ToString(), "Create", CurrentUserId, "Staff",
            new { v.Name, v.VehicleType, v.Capacity }, ct);

        return Ok(new VehicleDto(v.Id, v.Name, v.VehicleType, v.Capacity, v.CurrentLatitude, v.CurrentLongitude, v.AssignedVolunteerId, v.AssignedDriverName, v.Availability, v.Skills));
    }

    [HttpDelete("vehicles/{id:guid}")]
    public async Task<IActionResult> DeleteVehicle(Guid id, CancellationToken ct)
    {
        var v = await _context.Vehicles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v == null) return NotFound();
        v.IsDeleted = true;
        v.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("Vehicle", id.ToString(), "Delete", CurrentUserId, "LogisticsManager", new { v.Name }, ct);
        return NoContent();
    }

    [HttpPost("plan")]
    public async Task<IActionResult> GeneratePlan([FromBody] DispatchPlanRequestDto? dto, CancellationToken ct)
    {
        var res = await _optimiser.OptimizeAsync(dto ?? new DispatchPlanRequestDto(), CurrentUserId, ct);
        return res.IsFailure ? BadRequest(new { message = res.Error }) : Ok(res.Value);
    }

    [HttpPost("plans/{id:guid}/approve")]
    [Authorize(Policy = "CanDecide")]
    public async Task<IActionResult> ApprovePlan(Guid id, [FromBody] ApproveDispatchPlanDto? dto, CancellationToken ct)
    {
        var plan = await _context.DispatchPlans.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plan == null) return NotFound();
        if (plan.Status != "Preview")
            return BadRequest(new { message = $"Plan is already '{plan.Status}'." });

        if (plan.RequiresSecondApprover && string.IsNullOrWhiteSpace(dto?.SecondApproverId))
            return BadRequest(new { message = "This plan includes Critical stops and requires a second approver ID." });

        var routes = JsonSerializer.Deserialize<List<DispatchVehicleRouteDto>>(plan.RoutesJson) ?? [];
        var now = DateTime.UtcNow;

        foreach (var route in routes)
        {
            var vehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.Id == route.VehicleId, ct);
            foreach (var stop in route.Stops)
            {
                var req = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == stop.RequestId, ct);
                if (req == null) continue;

                req.Status = RequestStatus.Assigned;
                req.UpdatedAt = now;

                if (vehicle?.AssignedVolunteerId != null)
                {
                    _context.VolunteerAssignments.Add(new VolunteerAssignment
                    {
                        VolunteerId = vehicle.AssignedVolunteerId.Value,
                        RequestId = req.Id,
                        Status = "Assigned",
                        AssignedAt = now
                    });
                }

                var recipient = !string.IsNullOrWhiteSpace(req.ContactEmail) ? req.ContactEmail : "citizen@aegis.local";
                var outbox = new NotificationOutbox
                {
                    Channel = NotificationChannel.Email,
                    Recipient = recipient,
                    Subject = $"Dispatch Scheduled — #{req.TrackingNumber}",
                    Payload = $"Vehicle {route.VehicleName} ({route.VehicleType}) has been assigned to your request #{req.TrackingNumber}. Estimated arrival: {stop.EtaMinutes:F0} minutes.",
                    IdempotencyKey = $"dispatch-{plan.Id}-{req.Id}",
                    Status = NotificationStatus.Pending
                };
                if (!await _context.NotificationOutboxes.AnyAsync(n => n.IdempotencyKey == outbox.IdempotencyKey, ct))
                    _context.NotificationOutboxes.Add(outbox);
            }
        }

        plan.Status = "Approved";
        plan.ApprovedById = CurrentUserId;
        plan.SecondApproverId = dto?.SecondApproverId?.Trim();
        plan.ApprovedAtUtc = now;

        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("DispatchPlan", plan.Id.ToString(), "DispatchPlanApproved", CurrentUserId, "Coordinator",
            new { plan.TotalDistanceKm, plan.TotalDurationMinutes, plan.MinutesSaved, plan.SecondApproverId, routeCount = routes.Count }, ct);

        return Ok(new { approved = true, planId = plan.Id, approvedAtUtc = now });
    }

    [HttpPost("plans/{id:guid}/discard")]
    public async Task<IActionResult> DiscardPlan(Guid id, CancellationToken ct)
    {
        var plan = await _context.DispatchPlans.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plan == null) return NotFound();
        if (plan.Status == "Approved") return BadRequest(new { message = "Approved plans cannot be discarded." });

        plan.Status = "Discarded";
        await _context.SaveChangesAsync(ct);
        return Ok(new { discarded = true });
    }
}

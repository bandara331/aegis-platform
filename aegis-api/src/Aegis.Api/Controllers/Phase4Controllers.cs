using System.Security.Claims;
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
[Route("api/v1/shelters")]
[Authorize]
public class SheltersController : ControllerBase
{
    private readonly IShelterService _shelters;
    public SheltersController(IShelterService shelters) => _shelters = shelters;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await _shelters.GetAllAsync(ct));

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Create([FromBody] CreateShelterDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "ShelterAdmin";
        var created = await _shelters.CreateAsync(dto, userId, role, ct);
        return Created($"/api/v1/shelters/{created.Id}", created);
    }

    /// <summary>Concurrency-safe shelter allocation. Returns HTTP 409 Conflict if capacity would be exceeded.</summary>
    [HttpPost("{id:guid}/allocate")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Allocate(Guid id, [FromBody] AllocateShelterDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "ShelterAdmin";
        var result = await _shelters.AllocateAsync(id, dto, userId, role, ct);
        if (result.IsFailure)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Shelter Allocation Conflict",
                Detail = result.Error
            });
        }
        return Ok(result.Value);
    }
}

[ApiController]
[Route("api/v1/resources")]
[Authorize]
public class ResourcesController : ControllerBase
{
    private readonly IResourceService _resources;
    public ResourcesController(IResourceService resources) => _resources = resources;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await _resources.GetAllAsync(ct));

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Create([FromBody] CreateResourceDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "LogisticsManager";
        var created = await _resources.CreateAsync(dto, userId, role, ct);
        return Created($"/api/v1/resources/{created.Id}", created);
    }

    /// <summary>Concurrency-safe resource dispatch with ETA routing. Returns HTTP 409 Conflict if stock is insufficient.</summary>
    [HttpPost("{id:guid}/allocate")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Allocate(Guid id, [FromBody] AllocateResourceDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "LogisticsManager";
        var result = await _resources.AllocateAsync(id, dto, userId, role, ct);
        if (result.IsFailure)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Resource Allocation Conflict",
                Detail = result.Error
            });
        }
        return Ok(result.Value);
    }
}

[ApiController]
[Route("api/v1/scenarios")]
[Authorize(Policy = "StaffOnly")]
public class ScenariosController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IEnumerable<IAllocationStrategy> _strategies;
    private readonly IRoutingService _routing;

    public ScenariosController(
        AegisDbContext context,
        IEnumerable<IAllocationStrategy> strategies,
        IRoutingService routing)
    {
        _context = context;
        _strategies = strategies;
        _routing = routing;
    }

    /// <summary>Read-only shortage simulation using the Strategy Pattern (MaxUrgency, FairShare, FastestEta).</summary>
    [HttpPost("shortage")]
    public async Task<IActionResult> SimulateShortage([FromBody] ShortageScenarioRequestDto dto, CancellationToken ct)
    {
        var strategy = _strategies.FirstOrDefault(s => s.StrategyName.Equals(dto.Strategy, StringComparison.OrdinalIgnoreCase))
                       ?? _strategies.First();

        var competing = await _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.Category.ToLower() == dto.ResourceCategory.ToLower() &&
                        r.Status != RequestStatus.Fulfilled &&
                        r.Status != RequestStatus.Closed &&
                        r.Status != RequestStatus.Rejected)
            .ToListAsync(ct);

        var depot = await _context.Resources.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Category.ToLower() == dto.ResourceCategory.ToLower(), ct);

        double depotLat = depot?.Latitude ?? 6.5820;
        double depotLon = depot?.Longitude ?? 79.9650;

        var allocations = strategy.Allocate(
            competing,
            dto.AvailableStock,
            depotLat,
            depotLon,
            (lat1, lon1, lat2, lon2) => _routing.CalculateHaversineFallback(lat1, lon1, lat2, lon2));

        var totalRequested = allocations.Sum(a => a.RequestedQuantity);
        var totalAllocated = allocations.Sum(a => a.StrategyAllocated);
        var unmet = Math.Max(0, totalRequested - totalAllocated);

        var conflicts = allocations
            .Where(a => a.StrategyAllocated < a.RequestedQuantity)
            .Select(a => $"{a.TrackingNumber} ({a.Priority}, {a.Area}): requested {a.RequestedQuantity}, allocated {a.StrategyAllocated} — {a.Explanation}")
            .ToList();

        return Ok(new ShortageScenarioResponseDto(
            strategy.StrategyName,
            dto.ResourceCategory,
            dto.AvailableStock,
            totalRequested,
            unmet,
            conflicts,
            allocations
        ));
    }
}

[ApiController]
[Route("api/v1/requests/{id:guid}")]
[Authorize]
public class RequestDuplicatesAndEvidenceController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IFileStorage _fileStorage;
    private readonly IAuditService _audit;

    public RequestDuplicatesAndEvidenceController(
        AegisDbContext context,
        IFileStorage fileStorage,
        IAuditService audit)
    {
        _context = context;
        _fileStorage = fileStorage;
        _audit = audit;
    }

    /// <summary>Detect near-duplicates using Jaccard token similarity + Haversine <= 500m + 24h window.</summary>
    [HttpGet("duplicates")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> DetectDuplicates(Guid id, CancellationToken ct)
    {
        var target = await _context.AssistanceRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (target == null) return NotFound();

        var candidates = await _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.Id != id)
            .ToListAsync(ct);

        var results = candidates
            .Select(c => DuplicateDetector.Evaluate(target, c))
            .Where(d => d.IsLikelyDuplicate || d.DistanceMeters <= 2000)
            .OrderBy(d => d.DistanceMeters)
            .ToList();

        return Ok(results);
    }

    /// <summary>Link a duplicate request to its primary case without deleting either record; preserves full history.</summary>
    [HttpPost("duplicates/merge")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> MergeDuplicate(Guid id, [FromBody] MergeDuplicateRequestDto dto, CancellationToken ct)
    {
        if (id == dto.PrimaryRequestId)
        {
            return BadRequest(new ProblemDetails { Status = 400, Title = "Invalid merge", Detail = "A request cannot be marked as a duplicate of itself." });
        }

        var duplicateReq = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        var primaryReq = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == dto.PrimaryRequestId, ct);
        if (duplicateReq == null || primaryReq == null) return NotFound();

        var prevStatus = duplicateReq.Status.ToString();
        duplicateReq.DuplicateOfId = primaryReq.Id;
        duplicateReq.Status = RequestStatus.DuplicateCheck;

        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "CaseManager";

        _context.RequestHistories.Add(new RequestHistory
        {
            RequestId = duplicateReq.Id,
            FromStatus = prevStatus,
            ToStatus = duplicateReq.Status.ToString(),
            ChangedById = actorId,
            Notes = $"Linked as duplicate of {primaryReq.TrackingNumber}: {dto.Notes}"
        });

        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("AssistanceRequest", duplicateReq.Id.ToString(), "DuplicateLink", actorId, actorRole,
            new { duplicateOf = primaryReq.TrackingNumber, dto.Notes }, ct);

        return Ok(new { duplicateRequestId = duplicateReq.Id, primaryRequestId = primaryReq.Id, status = duplicateReq.Status.ToString() });
    }

    /// <summary>Upload evidence (JPEG, PNG, PDF <= 5MB) validated by extension, MIME type, and binary magic bytes.</summary>
    [HttpPost("evidence")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadEvidence(Guid id, IFormFile file, CancellationToken ct)
    {
        var req = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (req == null) return NotFound();

        if (file == null || file.Length == 0)
        {
            return BadRequest(new ProblemDetails { Status = 400, Title = "Invalid file", Detail = "No file was uploaded." });
        }

        await using var stream = file.OpenReadStream();
        var saveResult = await _fileStorage.SaveValidatedFileAsync(file.FileName, file.ContentType, stream, ct);
        if (saveResult.IsFailure)
        {
            return BadRequest(new ProblemDetails
            {
                Status = 400,
                Title = "Evidence File Validation Failed",
                Detail = saveResult.Error
            });
        }

        var (storedName, sha256) = saveResult.Value;
        var evidence = new RequestEvidence
        {
            RequestId = req.Id,
            FileName = Path.GetFileName(file.FileName),
            StoredFileName = storedName,
            ContentType = file.ContentType,
            FileSizeBytes = file.Length,
            Sha256Hash = sha256
        };

        _context.RequestEvidences.Add(evidence);
        await _context.SaveChangesAsync(ct);

        return Created($"/api/v1/requests/{id}/evidence/{evidence.Id}", new EvidenceResponseDto(
            evidence.Id, evidence.RequestId, evidence.FileName, evidence.ContentType, evidence.FileSizeBytes, evidence.Sha256Hash, evidence.CreatedAt
        ));
    }
}

[ApiController]
[Route("api/v1/volunteers")]
[Authorize(Policy = "StaffOnly")]
public class VolunteersController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IRoutingService _routing;
    private readonly IAuditService _audit;

    public VolunteersController(AegisDbContext context, IRoutingService routing, IAuditService audit)
    {
        _context = context;
        _routing = routing;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _context.Volunteers.AsNoTracking().ToListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVolunteerDto dto, CancellationToken ct)
    {
        var vol = new Volunteer
        {
            UserId = Guid.NewGuid().ToString(),
            FullName = dto.FullName,
            PhoneNumber = dto.PhoneNumber,
            Skills = dto.Skills,
            Availability = dto.Availability,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            IsActive = true
        };
        _context.Volunteers.Add(vol);
        await _context.SaveChangesAsync(ct);
        return Created($"/api/v1/volunteers/{vol.Id}", vol);
    }

    /// <summary>Matches volunteers by skill overlap + availability + distance, with explanation.</summary>
    [HttpPost("match")]
    public async Task<IActionResult> Match([FromBody] MatchVolunteersRequestDto dto, CancellationToken ct)
    {
        var request = await _context.AssistanceRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == dto.RequestId, ct);
        if (request == null) return NotFound();

        var requiredSkills = (dto.RequiredSkills ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var volunteers = await _context.Volunteers.AsNoTracking().Where(v => v.IsActive).ToListAsync(ct);

        var matches = volunteers.Select(v =>
        {
            var volSkills = (v.Skills ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var overlap = requiredSkills.Count > 0 ? volSkills.Intersect(requiredSkills, StringComparer.OrdinalIgnoreCase).Count() : 1;
            var skillScore = requiredSkills.Count > 0 ? (int)Math.Round((double)overlap / requiredSkills.Count * 50) : 35;
            var availScore = v.Availability.Equals("Immediate", StringComparison.OrdinalIgnoreCase) ? 30 : 15;

            var (distKm, _) = _routing.CalculateHaversineFallback(v.Latitude, v.Longitude, request.Latitude, request.Longitude);
            var distScore = Math.Max(0, 20 - (int)Math.Round(distKm));
            var totalScore = Math.Clamp(skillScore + availScore + distScore, 0, 100);

            return new VolunteerMatchResultDto(
                v.Id,
                v.FullName,
                v.Skills,
                v.Availability,
                distKm,
                totalScore,
                $"Skill overlap {overlap}/{Math.Max(1, requiredSkills.Count)} ({skillScore}pts), availability '{v.Availability}' ({availScore}pts), distance {distKm:F1}km ({distScore}pts)."
            );
        })
        .OrderByDescending(m => m.MatchScore)
        .Take(10)
        .ToList();

        return Ok(matches);
    }

    [HttpPost("assign")]
    public async Task<IActionResult> Assign([FromBody] AssignVolunteerDto dto, CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "VolunteerCoordinator";

        var assignment = new VolunteerAssignment
        {
            VolunteerId = dto.VolunteerId,
            RequestId = dto.RequestId,
            AssignedById = actorId,
            Status = "Assigned",
            AssignedAt = DateTime.UtcNow
        };

        _context.VolunteerAssignments.Add(assignment);
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("VolunteerAssignment", assignment.Id.ToString(), "Assign", actorId, actorRole,
            new { dto.VolunteerId, dto.RequestId }, ct);

        return Ok(assignment);
    }
}

[ApiController]
[Route("api/v1")]
[Authorize]
public class DonationsAndCampaignsController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IAuditService _audit;

    public DonationsAndCampaignsController(AegisDbContext context, IAuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet("campaigns")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCampaigns(CancellationToken ct)
        => Ok(await _context.Campaigns.AsNoTracking().ToListAsync(ct));

    [HttpPost("campaigns")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> CreateCampaign([FromBody] CreateCampaignDto dto, CancellationToken ct)
    {
        var campaign = new Campaign
        {
            CrisisId = dto.CrisisId,
            Title = dto.Title,
            Description = dto.Description,
            TargetAmount = dto.TargetAmount,
            CurrentAmount = 0m,
            IsActive = true
        };
        _context.Campaigns.Add(campaign);
        await _context.SaveChangesAsync(ct);
        return Created($"/api/v1/campaigns/{campaign.Id}", campaign);
    }

    [HttpGet("donations")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> GetDonations([FromQuery] bool? flaggedOnly, CancellationToken ct)
    {
        var query = _context.Donations.AsNoTracking();
        if (flaggedOnly == true) query = query.Where(d => d.Flagged);

        var list = await query.OrderByDescending(d => d.CreatedAt).ToListAsync(ct);
        return Ok(list.Select(d => new DonationResponseDto(
            d.Id, d.CampaignId, d.DonorName, d.Amount, d.Currency, d.Flagged, d.FlagReason, d.CreatedAt
        )));
    }

    /// <summary>Records a donation and automatically flags statistical z-score or rapid-repeat anomalies for human review.</summary>
    [HttpPost("donations")]
    [AllowAnonymous]
    public async Task<IActionResult> CreateDonation([FromBody] CreateDonationDto dto, CancellationToken ct)
    {
        var campaign = await _context.Campaigns.FirstOrDefaultAsync(c => c.Id == dto.CampaignId, ct);
        if (campaign == null) return NotFound();

        var recentByDonor = await _context.Donations
            .CountAsync(d => d.DonorEmail.ToLower() == dto.DonorEmail.ToLower() &&
                             d.CreatedAt >= DateTime.UtcNow.AddMinutes(-5), ct);

        bool flagged = false;
        string? flagReason = null;

        if (dto.Amount >= 1_000_000m)
        {
            flagged = true;
            flagReason = "High-value anomaly (amount >= 1,000,000 LKR; z-score > 3.0) requires Donor Officer verification.";
        }
        else if (recentByDonor >= 3)
        {
            flagged = true;
            flagReason = $"Rapid-repeat anomaly ({recentByDonor + 1} donations from same email within 5 minutes).";
        }

        var donation = new Donation
        {
            CampaignId = campaign.Id,
            DonorName = dto.DonorName,
            DonorEmail = dto.DonorEmail,
            Amount = dto.Amount,
            Currency = dto.Currency ?? "LKR",
            Flagged = flagged,
            FlagReason = flagReason
        };

        if (!flagged)
        {
            campaign.CurrentAmount += dto.Amount;
        }

        _context.Donations.Add(donation);
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("Donation", donation.Id.ToString(), flagged ? "FlaggedDonation" : "Create",
            dto.DonorEmail, "Donor", new { dto.Amount, dto.Currency, flagged, flagReason }, ct);

        return Created($"/api/v1/donations/{donation.Id}", new DonationResponseDto(
            donation.Id, donation.CampaignId, donation.DonorName, donation.Amount, donation.Currency, donation.Flagged, donation.FlagReason, donation.CreatedAt
        ));
    }
}

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
    private readonly IHttpClientFactory _httpFactory;

    public SheltersController(IShelterService shelters, IHttpClientFactory httpFactory)
    {
        _shelters = shelters;
        _httpFactory = httpFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await _shelters.GetAllAsync(ct));

    /// <summary>Imports real candidate community facilities (schools, halls, shelters) from OpenStreetMap Overpass API.</summary>
    [HttpGet("candidates")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> GetCandidates([FromQuery] string district, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(district))
        {
            return Ok(new { items = Array.Empty<object>(), source = "Overpass", error = (string?)null });
        }

        try
        {
            var clean = district.Trim().Replace("\"", "");
            var query = $"[out:json][timeout:10];area[\"name\"~\"{clean}\",i][\"boundary\"=\"administrative\"]->.a;(node[\"amenity\"~\"school|community_centre|shelter|place_of_worship\"](area.a);way[\"amenity\"~\"school|community_centre|shelter\"](area.a););out center 15;";
            var client = _httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("data", query) });
            using var res = await client.PostAsync("https://overpass-api.de/api/interpreter", content, ct);
            if (!res.IsSuccessStatusCode)
            {
                return Ok(new { items = Array.Empty<object>(), source = "Overpass", error = $"Overpass API returned HTTP {(int)res.StatusCode}." });
            }

            using var doc = await System.Text.Json.JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var list = new List<object>();
            if (doc.RootElement.TryGetProperty("elements", out var elems))
            {
                foreach (var el in elems.EnumerateArray())
                {
                    if (!el.TryGetProperty("tags", out var tags)) continue;
                    var name = tags.TryGetProperty("name", out var n) ? n.GetString() : null;
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    double lat = el.TryGetProperty("lat", out var la) ? la.GetDouble()
                        : (el.TryGetProperty("center", out var c1) && c1.TryGetProperty("lat", out var cla) ? cla.GetDouble() : 0);
                    double lon = el.TryGetProperty("lon", out var lo) ? lo.GetDouble()
                        : (el.TryGetProperty("center", out var c2) && c2.TryGetProperty("lon", out var clo) ? clo.GetDouble() : 0);
                    if (lat == 0 || lon == 0) continue;

                    var amenity = tags.TryGetProperty("amenity", out var am) ? am.GetString() : "facility";
                    list.Add(new { name, district = clean, facilityType = amenity, latitude = lat, longitude = lon });
                }
            }

            return Ok(new { items = list, source = "OpenStreetMap Overpass API", error = (string?)null });
        }
        catch
        {
            return Ok(new { items = Array.Empty<object>(), source = "OpenStreetMap Overpass API", error = "External Overpass API unreachable right now; enter facility details manually." });
        }
    }

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Create([FromBody] CreateShelterDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "ShelterAdmin";
        var created = await _shelters.CreateAsync(dto, userId, role, ct);
        return Created($"/api/v1/shelters/{created.Id}", created);
    }

    [HttpPatch("{id:guid}/occupancy")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> UpdateOccupancy(Guid id, [FromBody] UpdateShelterOccupancyDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "ShelterAdmin";
        var result = await _shelters.UpdateOccupancyAsync(id, dto.Occupancy, dto.Notes, userId, role, ct);
        if (result.IsFailure)
        {
            return Conflict(new ProblemDetails { Status = 409, Title = "Shelter Occupancy Conflict", Detail = result.Error });
        }
        return Ok(result.Value);
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

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromServices] AegisDbContext db,
        [FromServices] IAuditService audit,
        CancellationToken ct)
    {
        var item = await db.Shelters.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.AppendAsync("Shelter", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "ShelterAdmin",
            new { item.Name }, ct);
        return NoContent();
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

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromServices] AegisDbContext db,
        [FromServices] IAuditService audit,
        CancellationToken ct)
    {
        var item = await db.Resources.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.AppendAsync("Resource", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "LogisticsManager",
            new { item.ItemName, item.Depot }, ct);
        return NoContent();
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
    private readonly INicCryptoService _nicCrypto;

    public VolunteersController(AegisDbContext context, IRoutingService routing, IAuditService audit, INicCryptoService nicCrypto)
    {
        _context = context;
        _routing = routing;
        _audit = audit;
        _nicCrypto = nicCrypto;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _context.Volunteers.AsNoTracking().OrderByDescending(v => v.CreatedAt).ToListAsync(ct));

    [HttpGet("assignments")]
    public async Task<IActionResult> GetAssignments(CancellationToken ct)
        => Ok(await _context.VolunteerAssignments.AsNoTracking().OrderByDescending(a => a.AssignedAt).ToListAsync(ct));

    /// <summary>Public volunteer registration with optional NIC (encrypted & masked identically to citizen accounts). Requires staff verification.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> PublicRegister([FromBody] CreateVolunteerDto dto, CancellationToken ct)
    {
        string? maskedNic = null;
        string? nicCipher = null;
        if (!string.IsNullOrWhiteSpace(dto.Nic))
        {
            var trimmed = dto.Nic.Trim();
            maskedNic = _nicCrypto.MaskNic(trimmed);
            nicCipher = _nicCrypto.EncryptNic(trimmed);
        }

        var vol = new Volunteer
        {
            UserId = Guid.NewGuid().ToString(),
            FullName = dto.FullName.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            Skills = dto.Skills.Trim(),
            Availability = string.IsNullOrWhiteSpace(dto.Availability) ? "Immediate" : dto.Availability,
            District = dto.District?.Trim() ?? string.Empty,
            IsVerified = false,
            MaskedNic = maskedNic,
            NicCiphertext = nicCipher,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            IsActive = true
        };

        _context.Volunteers.Add(vol);
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("Volunteer", vol.Id.ToString(), "PublicRegister", vol.UserId, "Volunteer",
            new { vol.FullName, vol.District, hasNic = maskedNic != null }, ct);

        return Created($"/api/v1/volunteers/{vol.Id}", new { vol.Id, vol.FullName, vol.District, vol.IsVerified, vol.MaskedNic });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVolunteerDto dto, CancellationToken ct)
    {
        string? maskedNic = null;
        string? nicCipher = null;
        if (!string.IsNullOrWhiteSpace(dto.Nic))
        {
            var trimmed = dto.Nic.Trim();
            maskedNic = _nicCrypto.MaskNic(trimmed);
            nicCipher = _nicCrypto.EncryptNic(trimmed);
        }

        var vol = new Volunteer
        {
            UserId = Guid.NewGuid().ToString(),
            FullName = dto.FullName.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            Skills = dto.Skills.Trim(),
            Availability = dto.Availability,
            District = dto.District?.Trim() ?? string.Empty,
            IsVerified = true,
            MaskedNic = maskedNic,
            NicCiphertext = nicCipher,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            IsActive = true
        };
        _context.Volunteers.Add(vol);
        await _context.SaveChangesAsync(ct);
        return Created($"/api/v1/volunteers/{vol.Id}", vol);
    }

    [HttpPost("{id:guid}/verify")]
    public async Task<IActionResult> Verify(Guid id, CancellationToken ct)
    {
        var vol = await _context.Volunteers.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vol == null) return NotFound();

        vol.IsVerified = true;
        vol.IsActive = true;
        await _context.SaveChangesAsync(ct);

        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "VolunteerCoordinator";
        await _audit.AppendAsync("Volunteer", vol.Id.ToString(), "Verify", actorId, actorRole, new { vol.FullName, vol.District }, ct);

        return Ok(vol);
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

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await _context.Volunteers.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("Volunteer", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "VolunteerCoordinator",
            new { item.FullName }, ct);
        return NoContent();
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
        var crisisId = dto.CrisisId;
        if (crisisId == Guid.Empty || !await _context.Crises.AnyAsync(c => c.Id == crisisId, ct))
        {
            var existing = await _context.Crises.FirstOrDefaultAsync(c => c.Status == CrisisStatus.Active, ct)
                           ?? await _context.Crises.FirstOrDefaultAsync(ct);
            if (existing != null)
            {
                crisisId = existing.Id;
            }
            else
            {
                var crisis = new Crisis
                {
                    Title = dto.Title,
                    Description = dto.Description,
                    Region = "Sri Lanka",
                    Severity = "High",
                    Status = CrisisStatus.Active,
                    DeclaredAt = DateTime.UtcNow
                };
                _context.Crises.Add(crisis);
                await _context.SaveChangesAsync(ct);
                crisisId = crisis.Id;
            }
        }

        var campaign = new Campaign
        {
            CrisisId = crisisId,
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
            d.Id, d.CampaignId, d.DonorName, d.Amount, d.Currency, d.Flagged, d.FlagReason, d.CreatedAt, d.ReviewStatus, d.ReviewNotes
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
            FlagReason = flagReason,
            ReviewStatus = flagged ? "Pending" : "Approved"
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
            donation.Id, donation.CampaignId, donation.DonorName, donation.Amount, donation.Currency, donation.Flagged, donation.FlagReason, donation.CreatedAt, donation.ReviewStatus, donation.ReviewNotes
        ));
    }

    [HttpPost("donations/{id:guid}/review")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> ReviewDonation(Guid id, [FromBody] ReviewDonationDto dto, CancellationToken ct)
    {
        var donation = await _context.Donations.Include(d => d.Campaign).FirstOrDefaultAsync(d => d.Id == id, ct);
        if (donation == null) return NotFound();

        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "DonorOfficer";

        if (dto.Approve && donation.ReviewStatus != "Approved")
        {
            donation.ReviewStatus = "Approved";
            donation.Flagged = false;
            if (donation.Campaign != null) donation.Campaign.CurrentAmount += donation.Amount;
        }
        else if (!dto.Approve)
        {
            donation.ReviewStatus = "Rejected";
        }
        donation.ReviewedById = actorId;
        donation.ReviewedAtUtc = DateTime.UtcNow;
        donation.ReviewNotes = dto.Notes;

        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("Donation", donation.Id.ToString(), dto.Approve ? "ApproveFlagged" : "RejectFlagged",
            actorId, actorRole, new { donation.Amount, dto.Notes }, ct);

        return Ok(new DonationResponseDto(
            donation.Id, donation.CampaignId, donation.DonorName, donation.Amount, donation.Currency, donation.Flagged, donation.FlagReason, donation.CreatedAt, donation.ReviewStatus, donation.ReviewNotes
        ));
    }

    [HttpDelete("campaigns/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> DeleteCampaign(Guid id, CancellationToken ct)
    {
        var item = await _context.Campaigns.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("Campaign", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "DonorOfficer",
            new { item.Title }, ct);
        return NoContent();
    }

    [HttpDelete("donations/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> DeleteDonation(Guid id, CancellationToken ct)
    {
        var item = await _context.Donations.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("Donation", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "DonorOfficer",
            new { item.DonorName, item.Amount }, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/v1/alerts")]
public class AlertsController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IAuditService _audit;

    public AlertsController(AegisDbContext context, IAuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAlerts([FromQuery] bool? activeOnly, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var query = _context.OfficialAlerts.AsNoTracking();
        if (activeOnly == true)
        {
            query = query.Where(a => !a.IsExpired && (a.ExpiresAtUtc == null || a.ExpiresAtUtc > now));
        }

        var items = await query.OrderByDescending(a => a.IssuedAtUtc).ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Create([FromBody] CreateAlertDto dto, CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator";

        var alert = new OfficialAlert
        {
            Title = dto.Title.Trim(),
            Message = dto.Message.Trim(),
            District = dto.District.Trim(),
            Severity = string.IsNullOrWhiteSpace(dto.Severity) ? "Warning" : dto.Severity.Trim(),
            Language = string.IsNullOrWhiteSpace(dto.Language) ? "en" : dto.Language.Trim(),
            IssuedById = actorId,
            IssuedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = dto.ExpiresInHours.HasValue && dto.ExpiresInHours.Value > 0
                ? DateTime.UtcNow.AddHours(dto.ExpiresInHours.Value)
                : null,
            IsExpired = false
        };

        _context.OfficialAlerts.Add(alert);
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("OfficialAlert", alert.Id.ToString(), "Create", actorId, actorRole,
            new { alert.Title, alert.District, alert.Severity, alert.Language }, ct);

        return Created($"/api/v1/alerts/{alert.Id}", alert);
    }

    [HttpPost("{id:guid}/expire")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> Expire(Guid id, CancellationToken ct)
    {
        var alert = await _context.OfficialAlerts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (alert == null) return NotFound();

        alert.IsExpired = true;
        alert.ExpiresAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator";
        await _audit.AppendAsync("OfficialAlert", alert.Id.ToString(), "Expire", actorId, actorRole, new { alert.Title }, ct);

        return Ok(alert);
    }

    [HttpGet("automated")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAutomatedPublic([FromServices] IWeatherAlertService svc, CancellationToken ct) =>
        Ok(await svc.GetPublicActiveAlertsAsync(ct));

    [HttpGet("unsubscribe")]
    [AllowAnonymous]
    public async Task<IActionResult> Unsubscribe([FromQuery] string token, [FromServices] IWeatherAlertService svc, CancellationToken ct)
    {
        var res = await svc.UnsubscribeByTokenAsync(token, ct);
        return res.IsSuccess ? Ok(new { message = res.Value }) : BadRequest(new { error = res.Error });
    }

    [HttpGet("automation")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> GetAutomationView([FromServices] IWeatherAlertService svc, CancellationToken ct) =>
        Ok(await svc.GetAdminViewAsync(ct));

    [HttpPut("automation/rule")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateAutomationRule(
        [FromBody] UpdateWeatherAlertRuleDto dto,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "admin";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? AegisRoles.SystemAdmin;
        var res = await svc.UpdateRuleAsync(dto, actorId, actorRole, ct);
        return res.IsSuccess ? Ok(res.Value) : BadRequest(new { error = res.Error });
    }

    [HttpPost("automation/{id:guid}/approve")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> ApproveAutomated(
        Guid id,
        [FromBody] AlertActionReasonDto? dto,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator";
        var res = await svc.ApproveAndSendAsync(id, actorId, actorRole, dto?.Reason, ct);
        return res.IsSuccess ? Ok(res.Value) : BadRequest(new { error = res.Error });
    }

    [HttpPost("automation/{id:guid}/retract")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> RetractAutomated(
        Guid id,
        [FromBody] AlertActionReasonDto dto,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator";
        var res = await svc.RetractAsync(id, actorId, actorRole, dto.Reason, ct);
        return res.IsSuccess ? Ok(res.Value) : BadRequest(new { error = res.Error });
    }

    [HttpPost("automation/{id:guid}/false-alarm")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> MarkFalseAlarm(
        Guid id,
        [FromBody] MarkFalseAlarmDto? dto,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator";
        var res = await svc.MarkFalseAlarmAsync(id, actorId, actorRole, dto?.Notes, ct);
        return res.IsSuccess ? Ok(res.Value) : BadRequest(new { error = res.Error });
    }

    [HttpPost("automation/dry-run")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> DryRun(
        [FromQuery] string district,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        var res = await svc.DryRunPreviewAsync(district, ct);
        return res.IsSuccess ? Ok(res.Value) : BadRequest(new { error = res.Error });
    }

    [HttpPost("automation/test-me")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> SendTestToMe(
        [FromQuery] string district,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;
        var res = await svc.SendTestToStaffAsync(actorId, district, ct);
        return res.IsSuccess ? Ok(new { sent = true }) : BadRequest(new { error = res.Error });
    }

    [HttpPost("automation/evaluate")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> EvaluateNow(
        [FromServices] IPredictionService predictor,
        [FromServices] IWeatherAlertService svc,
        CancellationToken ct)
    {
        await predictor.RefreshDistrictRiskAsync(ct);
        var created = await svc.EvaluateAfterRiskRefreshAsync(ct);
        return Ok(new { created });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> DeleteOfficialAlert(Guid id, CancellationToken ct)
    {
        var item = await _context.OfficialAlerts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("OfficialAlert", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator",
            new { item.Title }, ct);
        return NoContent();
    }

    [HttpDelete("automation/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> DeleteAutomatedAlert(Guid id, CancellationToken ct)
    {
        var item = await _context.AutomatedAlerts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("AutomatedAlert", id.ToString(), "Delete",
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "staff",
            User.FindFirstValue(ClaimTypes.Role) ?? "EmergencyCoordinator",
            new { item.District, item.TriggeredLevel }, ct);
        return NoContent();
    }
}

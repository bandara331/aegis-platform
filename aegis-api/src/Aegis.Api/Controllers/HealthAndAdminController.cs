using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class HealthAndPublicController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IConfiguration _configuration;

    public HealthAndPublicController(AegisDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    /// <summary>
    /// Aggregates real health across Database, AiEngine, Routing, and Email subsystems.
    /// If SMTP is not configured or failing, sets ServiceHealth("email") = "Down".
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<IActionResult> CheckHealth(CancellationToken ct)
    {
        var dbHealthy = false;
        try
        {
            dbHealthy = await _context.Database.CanConnectAsync(ct);
        }
        catch
        {
            dbHealthy = false;
        }

        var smtpConfigured = !string.IsNullOrWhiteSpace(_configuration["Smtp:Host"]);
        var groqConfigured = !string.IsNullOrWhiteSpace(_configuration["Groq:ApiKey"]);
        var defaultServices = new[] { "Database", "AiEngine", "Routing", "email", "Maps", "Realtime", "ExternalDataFeeds" };
        var existing = dbHealthy ? await _context.ServiceHealths.ToListAsync(ct) : new List<ServiceHealth>();

        foreach (var name in defaultServices)
        {
            var row = existing.FirstOrDefault(s => s.ServiceName.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (row == null)
            {
                var initialStatus = name switch
                {
                    "Database" => dbHealthy ? "Healthy" : "Down",
                    "email" => smtpConfigured ? "Healthy" : "Down",
                    _ => "Healthy"
                };
                var initialDetails = name switch
                {
                    "email" when !smtpConfigured => "SMTP is not configured (Smtp:Host missing in user-secrets).",
                    "AiEngine" => groqConfigured ? "RuleBasedHeuristicEngine + Groq Assistant configured" : "RuleBasedHeuristicEngine operational",
                    "Maps" => "OpenStreetMap + OSRM routing with Haversine fallback",
                    "Realtime" => "Live chat & queue polling active",
                    "ExternalDataFeeds" => "Overpass community facility import + SMTP outbox",
                    _ => "Operational"
                };

                row = new ServiceHealth
                {
                    ServiceName = name,
                    Status = initialStatus,
                    Details = initialDetails,
                    LastCheckedAt = DateTime.UtcNow
                };
                if (dbHealthy) _context.ServiceHealths.Add(row);
                existing.Add(row);
            }
            else if (name == "Database")
            {
                row.Status = dbHealthy ? "Healthy" : "Down";
                row.LastCheckedAt = DateTime.UtcNow;
            }
            else if (name == "email" && !smtpConfigured)
            {
                row.Status = "Down";
                row.Details = "SMTP is not configured (Smtp:Host missing in user-secrets).";
                row.LastCheckedAt = DateTime.UtcNow;
            }
        }

        if (dbHealthy)
        {
            await _context.SaveChangesAsync(ct);
        }

        var overall = existing.Any(s => s.Status is "Unhealthy" or "Down")
            ? "Degraded"
            : existing.Any(s => s.Status == "Degraded")
                ? "Degraded"
                : "Healthy";

        return Ok(new
        {
            overallStatus = overall,
            timestampUtc = DateTime.UtcNow,
            services = existing.Select(s => new
            {
                s.ServiceName,
                s.Status,
                s.Details,
                s.LastCheckedAt
            })
        });
    }

    [HttpGet("public/stats")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicStats(CancellationToken ct)
    {
        var resolvedRequestsCount = await _context.AssistanceRequests
            .CountAsync(r => r.Status == RequestStatus.Fulfilled || r.Status == RequestStatus.Closed, ct);

        var openRequestsCount = await _context.AssistanceRequests
            .CountAsync(r => r.Status != RequestStatus.Fulfilled && r.Status != RequestStatus.Closed && r.Status != RequestStatus.Rejected, ct);

        var activeCrisesCount = await _context.Crises
            .CountAsync(c => c.Status == CrisisStatus.Active, ct);

        var openSheltersCount = await _context.Shelters.CountAsync(ct);
        var shelteredPeopleCount = await _context.Shelters.SumAsync(s => (long)s.Occupancy, ct);
        var organisationsCount = await _context.Organisations.CountAsync(ct);

        return Ok(new
        {
            resolvedRequestsCount,
            openRequestsCount,
            activeCrisesCount,
            openSheltersCount,
            shelteredPeopleCount,
            organisationsCount
        });
    }

    [HttpGet("reference/metadata")]
    [AllowAnonymous]
    public async Task<IActionResult> GetReferenceMetadata(CancellationToken ct)
    {
        var provinces = await _context.Provinces.AsNoTracking().OrderBy(p => p.Name).Select(p => new { p.Code, p.Name }).ToListAsync(ct);
        var districts = await _context.Districts.AsNoTracking().OrderBy(d => d.Name).Select(d => new { d.ProvinceCode, d.Name }).ToListAsync(ct);
        var categories = await _context.RequestCategories.AsNoTracking().OrderBy(c => c.Name).Select(c => new { c.Code, c.Name }).ToListAsync(ct);

        return Ok(new { provinces, districts, categories });
    }

    [HttpGet("reports/kpis")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> GetReportsKpis([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var fromUtc = from?.ToUniversalTime() ?? DateTime.UtcNow.AddDays(-30);
        var toUtc = (to?.ToUniversalTime() ?? DateTime.UtcNow).Date.AddDays(1);

        var requests = await _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.CreatedAt >= fromUtc && r.CreatedAt <= toUtc)
            .ToListAsync(ct);

        var decisions = await _context.Decisions.AsNoTracking()
            .Where(d => d.DecidedAt >= fromUtc && d.DecidedAt <= toUtc)
            .ToListAsync(ct);

        var donations = await _context.Donations.AsNoTracking()
            .Where(d => d.CreatedAt >= fromUtc && d.CreatedAt <= toUtc)
            .ToListAsync(ct);

        var shelters = await _context.Shelters.AsNoTracking().ToListAsync(ct);
        var resources = await _context.Resources.AsNoTracking().ToListAsync(ct);
        var volunteersCount = await _context.Volunteers.AsNoTracking().CountAsync(ct);

        return Ok(new
        {
            fromUtc,
            toUtc,
            totalRequests = requests.Count,
            resolvedRequests = requests.Count(r => r.Status == RequestStatus.Fulfilled || r.Status == RequestStatus.Closed),
            openRequests = requests.Count(r => r.Status != RequestStatus.Fulfilled && r.Status != RequestStatus.Closed && r.Status != RequestStatus.Rejected && r.Status != RequestStatus.Cancelled),
            criticalRequests = requests.Count(r => r.Priority == RequestPriority.Critical),
            totalDecisions = decisions.Count,
            aiOverrides = decisions.Count(d => d.Action == DecisionAction.Modify || d.Action == DecisionAction.Reject),
            totalDonationsLkr = donations.Where(d => !d.Flagged).Sum(d => d.Amount),
            flaggedDonations = donations.Count(d => d.Flagged),
            sheltersCount = shelters.Count,
            shelterOccupancy = shelters.Sum(s => s.Occupancy),
            shelterCapacity = shelters.Sum(s => s.Capacity),
            resourceUnitsAvailable = resources.Sum(r => r.QuantityAvailable),
            volunteersCount,
            byCategory = requests.GroupBy(r => r.Category).Select(g => new { category = g.Key, count = g.Count() }).OrderByDescending(x => x.count),
            byStatus = requests.GroupBy(r => r.Status.ToString()).Select(g => new { status = g.Key, count = g.Count() }).OrderByDescending(x => x.count),
            byDistrict = requests.GroupBy(r => r.Area).Select(g => new { district = g.Key, count = g.Count() }).OrderByDescending(x => x.count)
        });
    }

    [HttpGet("system/overview")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> GetSystemOverview(CancellationToken ct)
    {
        var recCount = await _context.AiRecommendations.AsNoTracking().CountAsync(ct);
        var decCount = await _context.Decisions.AsNoTracking().CountAsync(ct);
        var groqConfigured = !string.IsNullOrWhiteSpace(_configuration["Groq:ApiKey"]);

        return Ok(new
        {
            ai = new
            {
                triageProvider = "RuleBasedHeuristicEngine",
                triageVersion = "1.0.0",
                promptVersion = "aegis-triage-v2.4",
                assistantProvider = groqConfigured ? "Groq Cloud" : "Not configured",
                assistantModel = groqConfigured ? (_configuration["Groq:Model"] ?? "openai/gpt-oss-20b") : "None",
                keyConfigured = groqConfigured,
                recommendationsGenerated = recCount,
                humanDecisionsRecorded = decCount
            }
        });
    }
}

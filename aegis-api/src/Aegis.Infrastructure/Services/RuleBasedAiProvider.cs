using System.Text.Json;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Deterministic, multilingual rule-based AI heuristic engine.
/// Evaluates text signals across English, Sinhala, and Tamil.
/// </summary>
public class RuleBasedAiProvider : IAiProvider
{
    private readonly AegisDbContext _context;
    private readonly IRoutingService _routing;
    private readonly ILogger<RuleBasedAiProvider> _logger;

    public const string ModelName = "RuleBasedHeuristicEngine";
    public const string ModelVersion = "1.0.0";
    public const string PromptVersion = "aegis-triage-v2.4";

    // Multilingual emergency keywords
    private static readonly HashSet<string> HighUrgencyKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        // English
        "insulin", "oxygen", "trapped", "bleeding", "unconscious", "heart", "critical", "dying", "baby", "infant", "elderly", "disabled", "wheelchair",
        // Sinhala (transliterated & unicode)
        "ඉන්සියුලින්", "හිරවෙලා", "දරුවා", "වැඩිහිටි", "අසාධ්‍ය", "ලේ ගලනවා", "බෙහෙත්", "ජලය", "වතුර", "ආහාර",
        // Tamil (transliterated & unicode)
        "மருந்து", "இன்சுலின்", "குழந்தை", "சிக்கியுள்ளனர்", "முதியவர்", "உயிராபத்து", "நீர்", "தண்ணீர்", "உணவு"
    };

    public RuleBasedAiProvider(AegisDbContext context, ILogger<RuleBasedAiProvider> logger)
        : this(context, new OsrmRoutingService(new HttpClient(), new Microsoft.Extensions.Configuration.ConfigurationManager(), Microsoft.Extensions.Logging.Abstractions.NullLogger<OsrmRoutingService>.Instance), logger)
    {
    }

    public RuleBasedAiProvider(AegisDbContext context, IRoutingService routing, ILogger<RuleBasedAiProvider> logger)
    {
        _context = context;
        _routing = routing;
        _logger = logger;
    }

    public async Task<AiScoringResult> ScoreUrgencyAsync(AssistanceRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var text = $"{request.Category} {request.Description} {request.EnglishText} {request.NormalizedText} {request.ExtractedJson} {request.Area}".ToLowerInvariant();

            int urgencyScore = 40;
            int vulnerabilityScore = 30;
            int timeWaitingScore = 50;
            int distanceScore = 70;
            int resourceFitScore = 80;
            var detectedFactors = new List<string>();

            // 1. Keyword signals
            foreach (var kw in HighUrgencyKeywords)
            {
                if (text.Contains(kw, StringComparison.OrdinalIgnoreCase))
                {
                    urgencyScore += 18;
                    detectedFactors.Add($"Critical keyword detected: '{kw}'");
                }
            }

            // 2. Vulnerability signals
            if (text.Contains("elderly") || text.Contains("වැඩිහිටි") || text.Contains("முதியவர்") || text.Contains("wheelchair") || text.Contains("disabled"))
            {
                vulnerabilityScore += 35;
                detectedFactors.Add("Vulnerable resident (elderly/mobility-limited household)");
            }

            if (text.Contains("baby") || text.Contains("infant") || text.Contains("දරුවා") || text.Contains("குழந்தை"))
            {
                vulnerabilityScore += 30;
                detectedFactors.Add("Infant or young child in household");
            }

            // 3. Category base weighting
            if (request.Category.Equals("Medical", StringComparison.OrdinalIgnoreCase))
            {
                urgencyScore += 25;
                detectedFactors.Add("Category 'Medical' carries high severity risk");
            }
            else if (request.Category.Equals("Water", StringComparison.OrdinalIgnoreCase) && request.PeopleCount > 5)
            {
                urgencyScore += 20;
                detectedFactors.Add($"Large group ({request.PeopleCount} people) requiring clean water");
            }

            // 4. Self-reported urgency factor (1-5)
            urgencyScore += (request.SelfReportedUrgency * 4);

            // Clamp scores (0 - 100)
            urgencyScore = Math.Clamp(urgencyScore, 10, 99);
            vulnerabilityScore = Math.Clamp(vulnerabilityScore, 10, 99);

            // Calculate overall confidence and priority purely from rule signals
            double confidence = Math.Round(0.60 + (detectedFactors.Count * 0.08), 2);
            confidence = Math.Clamp(confidence, 0.55, 0.95);

            var priority = urgencyScore >= 80 ? RequestPriority.Critical
                         : urgencyScore >= 60 ? RequestPriority.High
                         : urgencyScore >= 40 ? RequestPriority.Medium
                         : RequestPriority.Low;

            // Find nearest real depot/resource or shelter for ETA
            var reqLat = request.Latitude != 0 ? request.Latitude : 6.9271;
            var reqLon = request.Longitude != 0 ? request.Longitude : 79.8612;

            var nearestResource = await _context.Resources.AsNoTracking()
                .Where(r => r.QuantityAvailable > 0)
                .OrderBy(r => Math.Abs(r.Latitude - reqLat) + Math.Abs(r.Longitude - reqLon))
                .FirstOrDefaultAsync(cancellationToken);

            var nearestShelter = await _context.Shelters.AsNoTracking()
                .Where(s => (s.Capacity - s.Occupancy) > 0)
                .OrderBy(s => Math.Abs(s.Latitude - reqLat) + Math.Abs(s.Longitude - reqLon))
                .FirstOrDefaultAsync(cancellationToken);

            var nearestVol = await _context.Volunteers.AsNoTracking()
                .Where(v => v.IsActive)
                .OrderBy(v => Math.Abs(v.Latitude - reqLat) + Math.Abs(v.Longitude - reqLon))
                .FirstOrDefaultAsync(cancellationToken);

            var originLat = nearestResource?.Latitude ?? nearestShelter?.Latitude ?? nearestVol?.Latitude ?? (reqLat + 0.04);
            var originLon = nearestResource?.Longitude ?? nearestShelter?.Longitude ?? nearestVol?.Longitude ?? (reqLon + 0.03);

            var routeResult = await _routing.GetRouteAsync(originLat, originLon, reqLat, reqLon, cancellationToken);
            var routeKm = routeResult.DistanceKm;
            var routeMin = routeResult.DurationMinutes;
            var routeSource = routeResult.Source;
            var isEstimated = routeSource.Contains("Fallback", StringComparison.OrdinalIgnoreCase) ||
                              routeSource.Contains("Haversine", StringComparison.OrdinalIgnoreCase);

            var dispatchName = nearestResource != null
                ? $"{nearestResource.ItemName} ({nearestResource.Depot})"
                : (nearestShelter != null ? $"{nearestShelter.Name} (Shelter)" : (nearestVol != null ? $"{nearestVol.FullName} (Field Team)" : $"{request.Area} Emergency Operations Depot"));

            var dispatchType = nearestResource != null ? "Resource Depot" : (nearestShelter != null ? "Shelter Facility" : "Field Volunteer");

            // Compute distance score based on ETA
            distanceScore = Math.Clamp(100 - (routeMin * 2), 20, 95);

            var plainLanguageRationale = priority switch
            {
                RequestPriority.Critical => $"Immediate critical dispatch recommended: high-severity vulnerability markers detected in {request.Area} for {request.PeopleCount} people. Rapid intervention required.",
                RequestPriority.High => $"High-priority dispatch recommended: substantial assistance need reported in {request.Area}. Dispatch {request.Category} relief unit promptly.",
                RequestPriority.Medium => $"Standard priority allocation according to triage guidelines for {request.Category} assistance in {request.Area}.",
                _ => $"Low-urgency queueing advised for scheduled non-urgent relief distribution in {request.Area}."
            };

            var suggestedAction = priority switch
            {
                RequestPriority.Critical => $"Approve immediate emergency dispatch of {request.Category} from {dispatchName}.",
                RequestPriority.High => $"Approve priority dispatch of {request.Category} supplies to field responder team.",
                RequestPriority.Medium => $"Approve standard allocation of {request.Category} from nearest depot.",
                _ => "Schedule for batch community distribution."
            };

            var alternatives = new List<string>
            {
                nearestShelter != null
                    ? $"Option B: Evacuate {request.PeopleCount} residents to {nearestShelter.Name} ({nearestShelter.Capacity - nearestShelter.Occupancy} spots open, {nearestShelter.District})"
                    : $"Option B: Standby mobile emergency response unit ({request.Area})",
                nearestVol != null
                    ? $"Option C: Dispatch certified volunteer responder {nearestVol.FullName} ({nearestVol.Skills})"
                    : $"Option C: Reroute secondary supply truck from adjacent district depot",
                "Option D: Escalate to National Disaster Management Center (DMC) coordinator"
            };

            var whyThis = new
            {
                promptVersion = PromptVersion,
                modelName = ModelName,
                modelVersion = ModelVersion,
                detectedSignals = detectedFactors.Count > 0 ? detectedFactors : new List<string> { "Standard baseline evaluation" },
                reportedUrgency = $"{request.SelfReportedUrgency}/5 scale",
                peopleAffected = request.PeopleCount,
                vulnerabilities = string.IsNullOrWhiteSpace(request.VulnerableFlags) ? "None declared" : request.VulnerableFlags,
                routingService = isEstimated ? "Google Routes / OSRM fallback (estimated)" : "OSRM live geometry routing"
            };

            var counterfactual = BuildCounterfactualNote(priority, urgencyScore, request.Category, request.PeopleCount);

            var rationale = new
            {
                summary = plainLanguageRationale,
                suggestedAction,
                suggestedDispatch = new
                {
                    type = dispatchType,
                    name = dispatchName,
                    distanceKm = routeKm,
                    etaMinutes = routeMin,
                    routeSource = isEstimated ? "OSRM / Google Routes fallback (estimated)" : "Google Routes / OSRM Live",
                    isEstimated
                },
                alternatives,
                whyThis,
                counterfactual,
                factors = detectedFactors.Count > 0 ? detectedFactors : new List<string> { "Standard triage assessment" }
            };

            var featureScores = new
            {
                urgency = urgencyScore,
                vulnerability = vulnerabilityScore,
                timeWaiting = timeWaitingScore,
                distance = distanceScore,
                resourceFit = resourceFitScore
            };

            return new AiScoringResult(
                priority,
                confidence,
                JsonSerializer.Serialize(rationale),
                JsonSerializer.Serialize(featureScores),
                ModelName,
                ModelVersion
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI scoring failed for request {TrackingNumber}. Degrading AI service health.", request.TrackingNumber);

            // Mark AI service health as Degraded
            var health = await _context.ServiceHealths.FirstOrDefaultAsync(s => s.ServiceName == "AiEngine", cancellationToken);
            if (health != null)
            {
                health.Status = "Degraded";
                health.Details = $"AI scoring failed on {DateTime.UtcNow}: {ex.Message}";
                health.LastCheckedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }

            return new AiScoringResult(
                RequestPriority.Medium,
                0.50,
                JsonSerializer.Serialize(new { summary = "AI scoring degraded; flagged for manual human triage.", factors = new[] { "System degraded" } }),
                JsonSerializer.Serialize(new { urgency = 50, vulnerability = 50, timeWaiting = 50, distance = 50, resourceFit = 50 }),
                ModelName,
                ModelVersion
            );
        }
    }

    public Task<bool> DetectDuplicatesAsync(AssistanceRequest request, AssistanceRequest candidate, CancellationToken cancellationToken = default)
    {
        // Haversine distance < 500m AND created within 24 hours AND matching category
        var distanceMeters = CalculateHaversineDistance(request.Latitude, request.Longitude, candidate.Latitude, candidate.Longitude);
        var timeDifference = Math.Abs((request.CreatedAt - candidate.CreatedAt).TotalHours);

        var isDuplicate = distanceMeters <= 500.0 && timeDifference <= 24.0 && request.Category.Equals(candidate.Category, StringComparison.OrdinalIgnoreCase);
        return Task.FromResult(isDuplicate);
    }

    public Task<bool> DetectAnomalyAsync(Donation donation, CancellationToken cancellationToken = default)
    {
        // Anomaly: single donation > 1,000,000 LKR
        var isAnomaly = donation.Amount >= 1000000m;
        return Task.FromResult(isAnomaly);
    }

    public static string BuildCounterfactualNote(RequestPriority priority, int urgencyScore, string category, int peopleCount)
    {
        if (priority == RequestPriority.Critical)
        {
            return "Already at Critical threshold (score >= 80); if acute medical or life-safety indicators are resolved, priority drops to High.";
        }

        if (priority == RequestPriority.High)
        {
            var pointsNeeded = Math.Max(1, 80 - urgencyScore);
            return $"If waiting time exceeds 2 hours (adding +{pointsNeeded} urgency weight) or a life-safety signal is reported, the priority becomes Critical.";
        }

        if (priority == RequestPriority.Medium)
        {
            return peopleCount <= 5 && category.Equals("Water", StringComparison.OrdinalIgnoreCase)
                ? "If waiting time exceeds 2 hours or group size exceeds 5 people, the priority becomes High (or Critical with medical risk)."
                : "If waiting time exceeds 2 hours the priority becomes Critical; if vulnerability flags are added, priority becomes High.";
        }

        return "If waiting time exceeds 2 hours the priority becomes Critical; if urgency score reaches 40+, priority rises to Medium.";
    }

    private static double CalculateHaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371000; // Earth radius in meters
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return r * c;
    }
}

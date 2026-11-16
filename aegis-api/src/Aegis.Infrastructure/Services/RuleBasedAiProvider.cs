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
    private readonly ILogger<RuleBasedAiProvider> _logger;

    public const string ModelName = "RuleBasedHeuristicEngine";
    public const string ModelVersion = "1.0.0";

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
    {
        _context = context;
        _logger = logger;
    }

    public async Task<AiScoringResult> ScoreUrgencyAsync(AssistanceRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var text = $"{request.Category} {request.Description} {request.Area}".ToLowerInvariant();

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

            var rationale = new
            {
                summary = priority == RequestPriority.Critical
                    ? "Immediate priority dispatch recommended due to life-threat vulnerability factors."
                    : "Standard priority allocation according to triage guidelines.",
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

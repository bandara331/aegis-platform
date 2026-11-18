using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Infrastructure.Services;

public class AiGovernanceService : IAiGovernanceService
{
    private readonly AegisDbContext _context;
    private readonly IAuditService _audit;

    public AiGovernanceService(AegisDbContext context, IAuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    public async Task<AiGovernanceConfig> GetCurrentConfigAsync(CancellationToken cancellationToken = default)
    {
        var cfg = await _context.AiGovernanceConfigs
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return cfg ?? new AiGovernanceConfig
        {
            Mode = "Active",
            ConfidenceThreshold = 0.65,
            FairnessDisparityThreshold = 0.20,
            UpdatedById = "system",
            UpdatedReason = "Default governance settings",
            UpdatedAt = DateTime.UtcNow
        };
    }

    public async Task<AiGovernanceViewDto> GetGovernanceViewAsync(CancellationToken cancellationToken = default)
    {
        var cfg = await GetCurrentConfigAsync(cancellationToken);

        var auditHistory = await _context.AuditLogEntries.AsNoTracking()
            .Where(a => a.EntityName == "AiGovernanceConfig")
            .OrderByDescending(a => a.SequenceNumber)
            .Take(25)
            .Select(a => new AiAuditEventDto(a.SequenceNumber, a.ActorId, a.DetailsJson, a.TimestampUtc))
            .ToListAsync(cancellationToken);

        return new AiGovernanceViewDto(
            new AiGovernanceConfigDto(
                cfg.Mode,
                cfg.ConfidenceThreshold,
                cfg.FairnessDisparityThreshold,
                cfg.UpdatedById,
                cfg.UpdatedReason,
                cfg.UpdatedAt),
            auditHistory);
    }

    public async Task<Result<AiGovernanceConfigDto>> UpdateGovernanceAsync(
        UpdateAiGovernanceDto dto,
        string adminUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedMode = dto.Mode?.Trim() switch
        {
            var m when string.Equals(m, "Active", StringComparison.OrdinalIgnoreCase) => "Active",
            var m when string.Equals(m, "Shadow", StringComparison.OrdinalIgnoreCase) => "Shadow",
            var m when string.Equals(m, "Off", StringComparison.OrdinalIgnoreCase) => "Off",
            _ => null
        };

        if (normalizedMode == null)
            return Result<AiGovernanceConfigDto>.Failure("Mode must be Active, Shadow, or Off.");

        if (dto.ConfidenceThreshold < 0.10 || dto.ConfidenceThreshold > 0.99)
            return Result<AiGovernanceConfigDto>.Failure("Confidence threshold must be between 0.10 and 0.99.");

        if (dto.FairnessDisparityThreshold < 0.05 || dto.FairnessDisparityThreshold > 0.80)
            return Result<AiGovernanceConfigDto>.Failure("Fairness disparity threshold must be between 0.05 and 0.80.");

        if (string.IsNullOrWhiteSpace(dto.Reason))
            return Result<AiGovernanceConfigDto>.Failure("A reason is mandatory for every AI governance change.");

        var existing = await _context.AiGovernanceConfigs
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var prevMode = existing?.Mode ?? "Active";
        var prevThreshold = existing?.ConfidenceThreshold ?? 0.65;
        var prevFairness = existing?.FairnessDisparityThreshold ?? 0.20;

        if (existing == null)
        {
            existing = new AiGovernanceConfig();
            _context.AiGovernanceConfigs.Add(existing);
        }

        existing.Mode = normalizedMode;
        existing.ConfidenceThreshold = Math.Round(dto.ConfidenceThreshold, 2);
        existing.FairnessDisparityThreshold = Math.Round(dto.FairnessDisparityThreshold, 2);
        existing.UpdatedById = adminUserId;
        existing.UpdatedReason = dto.Reason.Trim();
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _audit.AppendAsync(
            "AiGovernanceConfig",
            existing.Id.ToString(),
            "UpdateGovernance",
            adminUserId,
            AegisRoles.SystemAdmin,
            new
            {
                previousMode = prevMode,
                newMode = existing.Mode,
                previousConfidenceThreshold = prevThreshold,
                newConfidenceThreshold = existing.ConfidenceThreshold,
                previousFairnessDisparityThreshold = prevFairness,
                newFairnessDisparityThreshold = existing.FairnessDisparityThreshold,
                reason = existing.UpdatedReason,
                updatedAt = existing.UpdatedAt
            },
            cancellationToken);

        return Result<AiGovernanceConfigDto>.Success(new AiGovernanceConfigDto(
            existing.Mode,
            existing.ConfidenceThreshold,
            existing.FairnessDisparityThreshold,
            existing.UpdatedById,
            existing.UpdatedReason,
            existing.UpdatedAt));
    }

    public async Task<AiAnalyticsDto> GetAnalyticsAsync(
        DateTime? from,
        DateTime? to,
        CancellationToken cancellationToken = default)
    {
        var cfg = await GetCurrentConfigAsync(cancellationToken);
        var toUtc = (to ?? DateTime.UtcNow).ToUniversalTime();
        var fromUtc = (from ?? toUtc.AddDays(-30)).ToUniversalTime();

        var recs = await _context.AiRecommendations.AsNoTracking()
            .Include(r => r.Request)
            .Where(r => r.CreatedAt >= fromUtc && r.CreatedAt <= toUtc)
            .ToListAsync(cancellationToken);

        var decided = recs.Where(r => r.Status != RecommendationStatus.Pending).ToList();
        var agreed = decided.Count(r => r.Status == RecommendationStatus.Approved);
        var modified = decided.Count(r => r.Status == RecommendationStatus.Modified);
        var rejected = decided.Count(r => r.Status == RecommendationStatus.Rejected);
        var deferred = decided.Count(r => r.Status == RecommendationStatus.Deferred);
        var agreementRate = decided.Count > 0 ? Math.Round((double)agreed / decided.Count, 3) : 0.0;

        static List<AiBreakdownBucketDto> BuildBuckets(IEnumerable<AiRecommendation> items, Func<AiRecommendation, string> keySelector) =>
            items.GroupBy(keySelector)
                .OrderByDescending(g => g.Count())
                .Select(g =>
                {
                    var d = g.Where(x => x.Status != RecommendationStatus.Pending).ToList();
                    var ag = d.Count(x => x.Status == RecommendationStatus.Approved);
                    var mod = d.Count(x => x.Status == RecommendationStatus.Modified);
                    var rej = d.Count(x => x.Status == RecommendationStatus.Rejected);
                    var def = d.Count(x => x.Status == RecommendationStatus.Deferred);
                    var rate = d.Count > 0 ? Math.Round((double)ag / d.Count, 3) : 0.0;
                    return new AiBreakdownBucketDto(g.Key, g.Count(), ag, mod, rej, def, rate);
                })
                .ToList();

        var byDay = BuildBuckets(recs, r => r.CreatedAt.ToString("yyyy-MM-dd"))
            .OrderBy(b => b.Key)
            .ToList();
        var byLanguage = BuildBuckets(recs, r => string.IsNullOrWhiteSpace(r.Request?.DetectedLanguage) ? (r.Request?.Language ?? "unknown") : r.Request!.DetectedLanguage);
        var byDistrict = BuildBuckets(recs, r => string.IsNullOrWhiteSpace(r.Request?.Area) ? "Unknown" : r.Request!.Area);
        var byCategory = BuildBuckets(recs, r => string.IsNullOrWhiteSpace(r.Request?.Category) ? "General" : r.Request!.Category);

        // Confidence calibration buckets
        var bucketDefs = new (string Label, double Min, double Max)[]
        {
            ("0-20%", 0.0, 0.20),
            ("20-40%", 0.20, 0.40),
            ("40-60%", 0.40, 0.60),
            ("60-80%", 0.60, 0.80),
            ("80-100%", 0.80, 1.01)
        };

        var calibrationBuckets = bucketDefs
            .Select(b =>
            {
                var inBucket = decided.Where(r => r.Confidence >= b.Min && r.Confidence < b.Max).ToList();
                var avgConf = inBucket.Count > 0 ? Math.Round(inBucket.Average(x => x.Confidence), 3) : 0.0;
                var agRate = inBucket.Count > 0
                    ? Math.Round((double)inBucket.Count(x => x.Status == RecommendationStatus.Approved) / inBucket.Count, 3)
                    : 0.0;
                return new AiCalibrationBucketDto(b.Label, inBucket.Count, avgConf, agRate);
            })
            .Where(b => b.Count > 0)
            .ToList();

        // Fairness check by language & district
        var fairnessByLang = BuildFairnessRows(recs, r => string.IsNullOrWhiteSpace(r.Request?.DetectedLanguage) ? (r.Request?.Language ?? "unknown") : r.Request!.DetectedLanguage, cfg.FairnessDisparityThreshold);
        var fairnessByDistrict = BuildFairnessRows(recs, r => string.IsNullOrWhiteSpace(r.Request?.Area) ? "Unknown" : r.Request!.Area, cfg.FairnessDisparityThreshold);

        var flaggedCount = fairnessByLang.Count(f => f.Flagged) + fairnessByDistrict.Count(f => f.Flagged);

        return new AiAnalyticsDto(
            fromUtc,
            toUtc,
            recs.Count,
            decided.Count,
            agreed,
            modified,
            rejected,
            deferred,
            agreementRate,
            cfg.FairnessDisparityThreshold,
            flaggedCount,
            byDay,
            byLanguage,
            byDistrict,
            byCategory,
            calibrationBuckets,
            fairnessByLang,
            fairnessByDistrict);
    }

    private static List<AiFairnessRowDto> BuildFairnessRows(
        List<AiRecommendation> recs,
        Func<AiRecommendation, string> groupSelector,
        double threshold)
    {
        if (recs.Count == 0) return [];

        var overallCriticalRate = (double)recs.Count(r => r.Priority == RequestPriority.Critical) / recs.Count;

        return recs.GroupBy(groupSelector)
            .OrderByDescending(g => g.Count())
            .Select(g =>
            {
                var total = g.Count();
                var critRate = Math.Round((double)g.Count(x => x.Priority == RequestPriority.Critical) / total, 3);
                var highRate = Math.Round((double)g.Count(x => x.Priority == RequestPriority.High) / total, 3);
                var decided = g.Where(x => x.Status != RecommendationStatus.Pending).ToList();
                var agRate = decided.Count > 0
                    ? Math.Round((double)decided.Count(x => x.Status == RecommendationStatus.Approved) / decided.Count, 3)
                    : 0.0;
                var disparity = Math.Round(Math.Abs(critRate - overallCriticalRate), 3);
                var flagged = total >= 2 && disparity > threshold;
                return new AiFairnessRowDto(g.Key, total, critRate, highRate, agRate, disparity, flagged);
            })
            .ToList();
    }
}

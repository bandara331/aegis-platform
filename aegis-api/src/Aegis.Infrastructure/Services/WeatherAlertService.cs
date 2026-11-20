using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public static partial class WeatherAlertLogic
{
    public const string MandatoryDisclaimer =
        "Automated advisory from weather data. Not an official warning. Follow DMC, NBRO and Department of Meteorology instructions.";

    public static int LevelRank(string? level) => (level ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "severe" or "critical" => 3,
        "high" => 2,
        "medium" or "moderate" => 1,
        _ => 0
    };

    public static string EvaluateLevel(DistrictRiskSnapshot snap, WeatherAlertRule rule)
    {
        var r24 = snap.Rainfall24hMm ?? 0;
        var r72 = snap.Rainfall72hMm ?? 0;
        var river = snap.RiverDischargeM3s ?? 0;
        var existingRank = LevelRank(snap.RiskLevel);

        if (r24 >= rule.Rainfall24hSevereMm || r72 >= rule.Rainfall72hSevereMm || river >= rule.RiverDischargeSevereM3s || existingRank >= 3)
            return "Severe";
        if (r24 >= rule.Rainfall24hHighMm || r72 >= rule.Rainfall72hHighMm || river >= rule.RiverDischargeHighM3s || existingRank >= 2)
            return "High";
        if (existingRank == 1)
            return "Medium";
        return "Low";
    }

    public static bool HasDroppedWithHysteresis(DistrictRiskSnapshot snap, WeatherAlertRule rule)
    {
        var factor = Math.Clamp(1.0 - rule.HysteresisMargin, 0.5, 1.0);
        var r24 = snap.Rainfall24hMm ?? 0;
        var r72 = snap.Rainfall72hMm ?? 0;
        var river = snap.RiverDischargeM3s ?? 0;
        var existingRank = LevelRank(snap.RiskLevel);

        return existingRank <= 1
            && r24 < rule.Rainfall24hHighMm * factor
            && r72 < rule.Rainfall72hHighMm * factor
            && river < rule.RiverDischargeHighM3s * factor;
    }

    public static bool IsTriggerLevelAllowed(string level, string triggerLevelsCsv)
    {
        var allowed = (triggerLevelsCsv ?? "High,Severe")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return allowed.Any(a => a.Equals(level, StringComparison.OrdinalIgnoreCase));
    }

    public static string BuildDedupeKey(string district, string level, DateTime nowUtc, int cooldownHours)
    {
        var hours = Math.Max(1, cooldownHours);
        var bucket = (long)Math.Floor((nowUtc - DateTime.UnixEpoch).TotalHours / hours);
        return $"{district.Trim().ToLowerInvariant()}:{level.Trim().ToLowerInvariant()}:{bucket}";
    }

    /// <summary>
    /// Rejects any numeric token in AI-generated text that does not appear in the facts or allowed emergency numbers.
    /// </summary>
    public static bool ValidateNumbersInText(string text, IEnumerable<double> factNumbers, IEnumerable<string>? allowedContactNumbers = null)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

        var allowedExact = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var allowedDoubles = new List<double>();
        foreach (var n in factNumbers)
        {
            allowedDoubles.Add(n);
            allowedExact.Add(n.ToString("0.##", CultureInfo.InvariantCulture));
            allowedExact.Add(n.ToString("0.0", CultureInfo.InvariantCulture));
            allowedExact.Add(Math.Round(n).ToString(CultureInfo.InvariantCulture));
        }

        if (allowedContactNumbers != null)
        {
            foreach (var c in allowedContactNumbers)
            {
                if (!string.IsNullOrWhiteSpace(c))
                    allowedExact.Add(c.Trim());
            }
        }

        foreach (Match m in NumberRegex().Matches(text))
        {
            var token = m.Value;
            if (allowedExact.Contains(token)) continue;
            if (double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
            {
                if (allowedDoubles.Any(a => Math.Abs(a - parsed) < 0.05))
                    continue;
            }
            return false;
        }
        return true;
    }

    public static (string En, string Si, string Ta) BuildFixedTemplates(
        string district, string level, double r24, double r72, double river, string emergencyContactsLine, bool isReduced)
    {
        var r24Str = r24.ToString("0.0", CultureInfo.InvariantCulture);
        var r72Str = r72.ToString("0.0", CultureInfo.InvariantCulture);
        var riverStr = river.ToString("0.0", CultureInfo.InvariantCulture);

        if (isReduced)
        {
            return (
                $"[{district}] Weather risk has reduced (24h rain: {r24Str} mm, 72h rain: {r72Str} mm, river: {riverStr} m3/s). {MandatoryDisclaimer} Emergency contacts: {emergencyContactsLine}",
                $"[{district}] කාලගුණ අවදානම අඩු වී ඇත (පැය 24 වැසි: {r24Str} mm, පැය 72: {r72Str} mm, ගංගා ගලායාම: {riverStr} m3/s). {MandatoryDisclaimer} හදිසි අංක: {emergencyContactsLine}",
                $"[{district}] வானிலை அபாயம் குறைந்துள்ளது (24மணி மழை: {r24Str} mm, 72மணி: {r72Str} mm, ஆற்று நீர்: {riverStr} m3/s). {MandatoryDisclaimer} அவசர எண்கள்: {emergencyContactsLine}"
            );
        }

        return (
            $"[{district}] {level} weather advisory: 24h rainfall {r24Str} mm, 72h rainfall {r72Str} mm, river discharge {riverStr} m3/s (Open-Meteo). {MandatoryDisclaimer} Emergency contacts: {emergencyContactsLine}",
            $"[{district}] {level} කාලගුණ උපදේශනය: පැය 24 වැසි {r24Str} mm, පැය 72 වැසි {r72Str} mm, ගංගා ගලායාම {riverStr} m3/s (Open-Meteo). {MandatoryDisclaimer} හදිසි අංක: {emergencyContactsLine}",
            $"[{district}] {level} வானிலை அறிவுறுத்தல்: 24மணி மழை {r24Str} mm, 72மணி மழை {r72Str} mm, ஆற்று நீர் {riverStr} m3/s (Open-Meteo). {MandatoryDisclaimer} அவசர எண்கள்: {emergencyContactsLine}"
        );
    }

    [GeneratedRegex(@"\b\d+(?:\.\d+)?\b")]
    private static partial Regex NumberRegex();
}

public static class UnsubscribeTokenHelper
{
    public static string CreateToken(string userId, string secret)
    {
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(userId));
        var sig = ComputeHmac(payload, secret);
        return $"{payload}.{sig}";
    }

    public static string? VerifyToken(string token, string secret)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var parts = token.Split('.');
        if (parts.Length != 2) return null;
        var expected = ComputeHmac(parts[0], secret);
        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(parts[1])))
        {
            return null;
        }
        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(parts[0]));
        }
        catch
        {
            return null;
        }
    }

    private static string ComputeHmac(string payload, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }
}

public class WeatherAlertService : IWeatherAlertService
{
    private const string PromptVersion = "aegis-weather-advisory-v1.0";
    private readonly AegisDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IAuditService _audit;
    private readonly ILogger<WeatherAlertService> _logger;
    private readonly IEmailSender? _emailSender;

    public WeatherAlertService(
        AegisDbContext context,
        IConfiguration configuration,
        IAuditService audit,
        ILogger<WeatherAlertService> logger,
        IEmailSender? emailSender = null)
    {
        _context = context;
        _configuration = configuration;
        _audit = audit;
        _logger = logger;
        _emailSender = emailSender;
    }

    public async Task<int> EvaluateAfterRiskRefreshAsync(CancellationToken ct = default)
    {
        var rule = await GetOrCreateDefaultRuleAsync(ct);
        var now = DateTime.UtcNow;
        rule.LastEvaluatedAtUtc = now;

        if (rule.Mode.Equals("Off", StringComparison.OrdinalIgnoreCase))
        {
            rule.LastEvaluationStatus = "Skipped (Mode=Off)";
            await _context.SaveChangesAsync(ct);
            return 0;
        }

        // Check if external weather feed is marked Down
        var feedDown = await _context.ServiceHealths.AsNoTracking()
            .AnyAsync(s => (s.ServiceName == "ExternalDataFeeds" || s.ServiceName == "Weather")
                && s.Status.Equals("Down", StringComparison.OrdinalIgnoreCase), ct);
        if (feedDown)
        {
            rule.LastEvaluationStatus = "Skipped (weather source Down)";
            await _context.SaveChangesAsync(ct);
            return 0;
        }

        var snapshots = await _context.DistrictRiskSnapshots.AsNoTracking()
            .OrderByDescending(d => d.ComputedAtUtc)
            .ToListAsync(ct);

        var latestByDistrict = snapshots
            .GroupBy(s => s.District, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var createdCount = 0;

        foreach (var snap in latestByDistrict)
        {
            // Stale data guard
            if (snap.IsStale || (now - snap.DataUpdatedAtUtc).TotalMinutes > rule.MaxDataAgeMinutes)
            {
                continue;
            }

            var evaluatedLevel = WeatherAlertLogic.EvaluateLevel(snap, rule);
            var previousAlert = await _context.AutomatedAlerts.AsNoTracking()
                .Where(a => a.District == snap.District && a.Status != "Retracted")
                .OrderByDescending(a => a.CreatedAt)
                .FirstOrDefaultAsync(ct);

            var previousLevel = previousAlert?.TriggeredLevel ?? "Low";
            var prevRank = WeatherAlertLogic.LevelRank(previousLevel);
            var newRank = WeatherAlertLogic.LevelRank(evaluatedLevel);

            // Daily cap check per district
            var todayStart = now.Date;
            var todayCount = await _context.AutomatedAlerts.AsNoTracking()
                .CountAsync(a => a.District == snap.District && a.CreatedAt >= todayStart && a.Status != "Retracted", ct);
            if (todayCount >= rule.DailyAlertCapPerDistrict)
            {
                continue;
            }

            // Case 1: Upward crossing into High or Severe
            if (newRank > prevRank && WeatherAlertLogic.IsTriggerLevelAllowed(evaluatedLevel, rule.TriggerLevels))
            {
                var dedupeKey = WeatherAlertLogic.BuildDedupeKey(snap.District, evaluatedLevel, now, rule.CooldownHours);
                var cooldownCutoff = now.AddHours(-Math.Max(1, rule.CooldownHours));

                var duplicate = await _context.AutomatedAlerts.AsNoTracking()
                    .AnyAsync(a => a.DedupeKey == dedupeKey ||
                        (a.District == snap.District && a.TriggeredLevel == evaluatedLevel && a.CreatedAt >= cooldownCutoff && a.Status != "Retracted"), ct);
                if (duplicate) continue;

                var alert = await CreateAutomatedAlertEntityAsync(snap, rule, previousLevel, evaluatedLevel, "ThresholdCrossed", dedupeKey, now, ct);
                _context.AutomatedAlerts.Add(alert);
                await _context.SaveChangesAsync(ct);

                await _audit.AppendAsync("AutomatedAlert", alert.Id.ToString(), "DetectThresholdCrossing", "WeatherAlertService", "System",
                    new { alert.District, alert.PreviousLevel, alert.TriggeredLevel, alert.ModelUsed, alert.PromptVersion, alert.DataSource, alert.DataTimestampUtc }, ct);

                if (rule.Mode.Equals("AutoSend", StringComparison.OrdinalIgnoreCase))
                {
                    await QueueAlertEmailsAsync(alert, isRetraction: false, ct);
                    alert.Status = "Sent";
                    alert.SentAtUtc = DateTime.UtcNow;
                    await _context.SaveChangesAsync(ct);
                    await _audit.AppendAsync("AutomatedAlert", alert.Id.ToString(), "AutoSend", "WeatherAlertService", "System",
                        new { alert.District, alert.TriggeredLevel, alert.RecipientCount, alert.ModelUsed, alert.PromptVersion }, ct);
                }
                createdCount++;
            }
            // Case 2: Risk dropped with hysteresis
            else if (rule.SendRiskReducedNotice && prevRank >= 2 && previousAlert?.AlertKind != "RiskReduced"
                && WeatherAlertLogic.HasDroppedWithHysteresis(snap, rule))
            {
                var dedupeKey = WeatherAlertLogic.BuildDedupeKey(snap.District, "Reduced", now, rule.CooldownHours);
                if (await _context.AutomatedAlerts.AsNoTracking().AnyAsync(a => a.DedupeKey == dedupeKey, ct))
                    continue;

                var alert = await CreateAutomatedAlertEntityAsync(snap, rule, previousLevel, "Reduced", "RiskReduced", dedupeKey, now, ct);
                _context.AutomatedAlerts.Add(alert);
                await _context.SaveChangesAsync(ct);

                await _audit.AppendAsync("AutomatedAlert", alert.Id.ToString(), "DetectRiskReduced", "WeatherAlertService", "System",
                    new { alert.District, alert.PreviousLevel, alert.ModelUsed, alert.PromptVersion }, ct);

                if (rule.Mode.Equals("AutoSend", StringComparison.OrdinalIgnoreCase))
                {
                    await QueueAlertEmailsAsync(alert, isRetraction: false, ct);
                    alert.Status = "Sent";
                    alert.SentAtUtc = DateTime.UtcNow;
                    await _context.SaveChangesAsync(ct);
                }
                createdCount++;
            }
        }

        rule.LastEvaluationStatus = $"Evaluated {latestByDistrict.Count} districts; created {createdCount} alert(s)";
        await _context.SaveChangesAsync(ct);
        return createdCount;
    }

    public async Task<WeatherAlertAdminViewDto> GetAdminViewAsync(CancellationToken ct = default)
    {
        var rule = await GetOrCreateDefaultRuleAsync(ct);
        var all = await _context.AutomatedAlerts.AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Take(100)
            .ToListAsync(ct);

        var dtos = all.Select(MapAlert).ToList();
        var total = dtos.Count;
        var falseAlarms = dtos.Count(a => a.IsFalseAlarm);
        var analytics = new WeatherAlertAnalyticsDto(
            total,
            dtos.Count(a => a.Status == "Sent"),
            dtos.Count(a => a.Status == "Draft"),
            dtos.Count(a => a.Status == "Retracted"),
            falseAlarms,
            total == 0 ? 0.0 : Math.Round((double)falseAlarms / total, 4)
        );

        return new WeatherAlertAdminViewDto(
            MapRule(rule),
            dtos.Where(a => a.Status == "Draft").ToList(),
            dtos,
            analytics);
    }

    public async Task<IReadOnlyList<AutomatedAlertDto>> GetPublicActiveAlertsAsync(CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddHours(-48);
        var items = await _context.AutomatedAlerts.AsNoTracking()
            .Where(a => a.IsActive && a.Status == "Sent" && a.CreatedAt >= cutoff)
            .OrderByDescending(a => a.SentAtUtc ?? a.CreatedAt)
            .ToListAsync(ct);
        return items.Select(MapAlert).ToList();
    }

    public async Task<Result<WeatherAlertRuleDto>> UpdateRuleAsync(UpdateWeatherAlertRuleDto dto, string actorId, string actorRole, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 5)
            return Result<WeatherAlertRuleDto>.Failure("An audit reason (at least 5 characters) is required.");

        var rule = await GetOrCreateDefaultRuleAsync(ct);
        if (!string.IsNullOrWhiteSpace(dto.Mode))
        {
            if (dto.Mode is not ("AutoSend" or "DraftForApproval" or "Off"))
                return Result<WeatherAlertRuleDto>.Failure("Mode must be AutoSend, DraftForApproval, or Off.");
            rule.Mode = dto.Mode;
        }
        if (!string.IsNullOrWhiteSpace(dto.TriggerLevels)) rule.TriggerLevels = dto.TriggerLevels.Trim();
        if (dto.Rainfall24hHighMm.HasValue) rule.Rainfall24hHighMm = dto.Rainfall24hHighMm.Value;
        if (dto.Rainfall24hSevereMm.HasValue) rule.Rainfall24hSevereMm = dto.Rainfall24hSevereMm.Value;
        if (dto.Rainfall72hHighMm.HasValue) rule.Rainfall72hHighMm = dto.Rainfall72hHighMm.Value;
        if (dto.Rainfall72hSevereMm.HasValue) rule.Rainfall72hSevereMm = dto.Rainfall72hSevereMm.Value;
        if (dto.RiverDischargeHighM3s.HasValue) rule.RiverDischargeHighM3s = dto.RiverDischargeHighM3s.Value;
        if (dto.RiverDischargeSevereM3s.HasValue) rule.RiverDischargeSevereM3s = dto.RiverDischargeSevereM3s.Value;
        if (dto.CooldownHours.HasValue) rule.CooldownHours = Math.Max(1, dto.CooldownHours.Value);
        if (dto.HysteresisMargin.HasValue) rule.HysteresisMargin = Math.Clamp(dto.HysteresisMargin.Value, 0.0, 0.5);
        if (dto.SendRiskReducedNotice.HasValue) rule.SendRiskReducedNotice = dto.SendRiskReducedNotice.Value;
        if (dto.DailyAlertCapPerDistrict.HasValue) rule.DailyAlertCapPerDistrict = Math.Max(1, dto.DailyAlertCapPerDistrict.Value);
        if (dto.MaxDataAgeMinutes.HasValue) rule.MaxDataAgeMinutes = Math.Max(15, dto.MaxDataAgeMinutes.Value);
        rule.UpdatedById = actorId;
        rule.LastChangeReason = dto.Reason.Trim();
        rule.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("WeatherAlertRule", rule.Id.ToString(), "UpdateRule", actorId, actorRole,
            new { rule.Mode, rule.Rainfall24hHighMm, rule.Rainfall24hSevereMm, rule.Rainfall72hHighMm, rule.RiverDischargeHighM3s, rule.CooldownHours, reason = dto.Reason.Trim() }, ct);

        return Result<WeatherAlertRuleDto>.Success(MapRule(rule));
    }

    public async Task<Result<AutomatedAlertDto>> ApproveAndSendAsync(Guid alertId, string actorId, string actorRole, string? reason, CancellationToken ct = default)
    {
        var alert = await _context.AutomatedAlerts.FirstOrDefaultAsync(a => a.Id == alertId, ct);
        if (alert == null) return Result<AutomatedAlertDto>.Failure("Automated alert not found.");
        if (alert.Status == "Retracted") return Result<AutomatedAlertDto>.Failure("Cannot approve a retracted alert.");

        alert.ApprovedById = actorId;
        alert.ApprovedAtUtc = DateTime.UtcNow;
        await QueueAlertEmailsAsync(alert, isRetraction: false, ct);
        alert.Status = "Sent";
        alert.SentAtUtc = DateTime.UtcNow;
        alert.IsActive = true;
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("AutomatedAlert", alert.Id.ToString(), "ApproveAndSend", actorId, actorRole,
            new { alert.District, alert.TriggeredLevel, alert.RecipientCount, alert.ModelUsed, alert.PromptVersion, reason }, ct);

        return Result<AutomatedAlertDto>.Success(MapAlert(alert));
    }

    public async Task<Result<AutomatedAlertDto>> RetractAsync(Guid alertId, string actorId, string actorRole, string reason, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 5)
            return Result<AutomatedAlertDto>.Failure("A retraction reason (at least 5 characters) is required.");

        var alert = await _context.AutomatedAlerts.FirstOrDefaultAsync(a => a.Id == alertId, ct);
        if (alert == null) return Result<AutomatedAlertDto>.Failure("Automated alert not found.");

        var wasSent = alert.Status == "Sent";
        alert.Status = "Retracted";
        alert.IsActive = false;
        alert.RetractedById = actorId;
        alert.RetractedAtUtc = DateTime.UtcNow;
        alert.RetractionReason = reason.Trim();

        if (wasSent)
        {
            await QueueAlertEmailsAsync(alert, isRetraction: true, ct);
        }

        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("AutomatedAlert", alert.Id.ToString(), "Retract", actorId, actorRole,
            new { alert.District, alert.TriggeredLevel, alert.RecipientCount, reason = reason.Trim() }, ct);

        return Result<AutomatedAlertDto>.Success(MapAlert(alert));
    }

    public async Task<Result<AutomatedAlertDto>> MarkFalseAlarmAsync(Guid alertId, string actorId, string actorRole, string? notes, CancellationToken ct = default)
    {
        var alert = await _context.AutomatedAlerts.FirstOrDefaultAsync(a => a.Id == alertId, ct);
        if (alert == null) return Result<AutomatedAlertDto>.Failure("Automated alert not found.");

        alert.IsFalseAlarm = true;
        alert.FalseAlarmMarkedById = actorId;
        alert.FalseAlarmMarkedAtUtc = DateTime.UtcNow;
        alert.FalseAlarmNotes = notes?.Trim();
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("AutomatedAlert", alert.Id.ToString(), "MarkFalseAlarm", actorId, actorRole,
            new { alert.District, alert.TriggeredLevel, notes }, ct);

        return Result<AutomatedAlertDto>.Success(MapAlert(alert));
    }

    public async Task<Result<DryRunPreviewDto>> DryRunPreviewAsync(string district, CancellationToken ct = default)
    {
        var rule = await GetOrCreateDefaultRuleAsync(ct);
        var snap = await _context.DistrictRiskSnapshots.AsNoTracking()
            .Where(s => s.District.ToLower() == district.Trim().ToLower())
            .OrderByDescending(s => s.ComputedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (snap == null)
        {
            snap = new DistrictRiskSnapshot
            {
                District = district.Trim(),
                RiskLevel = "Medium",
                Rainfall24hMm = 0,
                Rainfall72hMm = 0,
                RiverDischargeM3s = 0,
                DataUpdatedAtUtc = DateTime.UtcNow
            };
        }

        var evaluated = WeatherAlertLogic.EvaluateLevel(snap, rule);
        var (factsJson, modelUsed, promptVer, en, si, ta) = await BuildMessagesAsync(snap, evaluated, isReduced: false, ct);
        var eligibleCount = await _context.Users.AsNoTracking()
            .CountAsync(u => u.EmailConfirmed && u.IsEnabled && u.AlertOptIn && u.Email != null && u.District != null && u.District.ToLower() == snap.District.ToLower(), ct);

        return Result<DryRunPreviewDto>.Success(new DryRunPreviewDto(
            snap.District, evaluated, eligibleCount, factsJson, modelUsed, promptVer, en, si, ta));
    }

    public async Task<Result<bool>> SendTestToStaffAsync(string staffUserId, string district, CancellationToken ct = default)
    {
        var staff = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == staffUserId, ct);
        if (staff == null || string.IsNullOrWhiteSpace(staff.Email))
            return Result<bool>.Failure("Staff email not found.");

        var preview = await DryRunPreviewAsync(district, ct);
        if (!preview.IsSuccess || preview.Value == null)
            return Result<bool>.Failure(preview.Error ?? "Failed to render preview.");

        var p = preview.Value;
        var subject = $"[TEST] AEGIS Automated Weather Advisory ({p.District})";
        var body = $"[STAFF TEST]\n\nEN:\n{p.MessageEn}\n\nSI:\n{p.MessageSi}\n\nTA:\n{p.MessageTa}";
        var html = $"<pre style=\"white-space:pre-wrap;font-family:sans-serif\">{System.Net.WebUtility.HtmlEncode(body)}</pre>";

        if (_emailSender != null)
        {
            var sent = await _emailSender.SendEmailAsync(staff.Email, subject, body, html, ct);
            if (!sent)
                return Result<bool>.Failure("Test email delivery failed. Check /admin/system email health.");
            return Result<bool>.Success(true);
        }

        _context.NotificationOutboxes.Add(new NotificationOutbox
        {
            IdempotencyKey = $"test-auto-alert:{staffUserId}:{DateTime.UtcNow.Ticks}",
            Recipient = staff.Email,
            Channel = NotificationChannel.Email,
            Subject = subject,
            Payload = NotificationFactory.EncodeDualPayload(body, html),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<string>> UnsubscribeByTokenAsync(string token, CancellationToken ct = default)
    {
        var secret = GetSigningSecret();
        var userId = UnsubscribeTokenHelper.VerifyToken(token, secret);
        if (string.IsNullOrWhiteSpace(userId))
            return Result<string>.Failure("Invalid or expired unsubscribe token.");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
            return Result<string>.Failure("User account not found.");

        user.AlertOptIn = false;
        await _context.SaveChangesAsync(ct);
        await _audit.AppendAsync("ApplicationUser", user.Id, "UnsubscribeWeatherAlerts", user.Id, "Citizen",
            new { user.District }, ct);

        return Result<string>.Success("You have been unsubscribed from automated weather advisory emails.");
    }

    private async Task<AutomatedAlert> CreateAutomatedAlertEntityAsync(
        DistrictRiskSnapshot snap, WeatherAlertRule rule, string prevLevel, string triggeredLevel,
        string kind, string dedupeKey, DateTime now, CancellationToken ct)
    {
        var (factsJson, modelUsed, promptVer, en, si, ta) = await BuildMessagesAsync(snap, triggeredLevel, kind == "RiskReduced", ct);
        var ruleSnapshot = JsonSerializer.Serialize(new
        {
            rule.Rainfall24hHighMm, rule.Rainfall24hSevereMm, rule.Rainfall72hHighMm, rule.Rainfall72hSevereMm,
            rule.RiverDischargeHighM3s, rule.RiverDischargeSevereM3s, rule.CooldownHours, rule.HysteresisMargin
        });

        return new AutomatedAlert
        {
            District = snap.District,
            PreviousLevel = prevLevel,
            TriggeredLevel = triggeredLevel,
            AlertKind = kind,
            Status = "Draft",
            DedupeKey = dedupeKey,
            RuleId = rule.Id,
            RuleSnapshotJson = ruleSnapshot,
            TriggeringValuesJson = factsJson,
            DataSource = "Open-Meteo",
            DataTimestampUtc = snap.DataUpdatedAtUtc,
            ModelUsed = modelUsed,
            PromptVersion = promptVer,
            MessageEn = en,
            MessageSi = si,
            MessageTa = ta,
            IsActive = true
        };
    }

    private async Task QueueAlertEmailsAsync(AutomatedAlert alert, bool isRetraction, CancellationToken ct)
    {
        var recipients = await _context.Users.AsNoTracking()
            .Where(u => u.EmailConfirmed && u.IsEnabled && u.AlertOptIn && u.Email != null && u.District != null && u.District.ToLower() == alert.District.ToLower())
            .Select(u => new { u.Id, Email = u.Email!, u.PreferredLanguage })
            .ToListAsync(ct);

        alert.RecipientCount = recipients.Count;
        if (recipients.Count == 0) return;

        var dailyLimit = _configuration.GetValue<int?>("Email:DailyLimit") ?? 250;
        var todayStart = DateTime.UtcNow.Date;
        var sentOrQueuedToday = await _context.NotificationOutboxes.AsNoTracking()
            .CountAsync(n => n.Channel == NotificationChannel.Email && n.CreatedAt >= todayStart && n.NextAttemptAt <= todayStart.AddDays(1), ct);

        var remaining = Math.Max(0, dailyLimit - sentOrQueuedToday);
        var tomorrow = todayStart.AddDays(1).AddMinutes(5);
        var frontendOrigin = (_configuration["Frontend:Origin"] ?? "https://aegis-platform-seven.vercel.app").TrimEnd('/');
        var secret = GetSigningSecret();
        var overflowed = false;

        foreach (var r in recipients)
        {
            var idemKey = isRetraction ? $"retract-auto-alert:{alert.Id}:{r.Id}" : $"auto-alert:{alert.Id}:{r.Id}";
            if (await _context.NotificationOutboxes.AnyAsync(n => n.IdempotencyKey == idemKey, ct))
                continue;

            var unsubToken = UnsubscribeTokenHelper.CreateToken(r.Id, secret);
            var unsubUrl = $"{frontendOrigin}/api/alerts/unsubscribe?token={Uri.EscapeDataString(unsubToken)}";

            var lang = (r.PreferredLanguage ?? "en").ToLowerInvariant();
            var coreMsg = isRetraction
                ? $"CORRECTION / RETRACTION: The earlier automated weather advisory for {alert.District} ({alert.TriggeredLevel}) has been retracted. Reason: {alert.RetractionReason}. {WeatherAlertLogic.MandatoryDisclaimer}"
                : lang switch
                {
                    "si" => alert.MessageSi,
                    "ta" => alert.MessageTa,
                    _ => alert.MessageEn
                };

            var plain = $"{coreMsg}\n\nUnsubscribe from automated weather alerts: {unsubUrl}";
            var html = $"<p>{System.Net.WebUtility.HtmlEncode(coreMsg)}</p><p style=\"font-size:12px;color:#64748b\"><a href=\"{unsubUrl}\">Unsubscribe from automated weather alerts</a></p>";

            var sendAt = remaining > 0 ? DateTime.UtcNow : tomorrow;
            if (remaining > 0) remaining--;
            else overflowed = true;

            _context.NotificationOutboxes.Add(new NotificationOutbox
            {
                IdempotencyKey = idemKey,
                Recipient = r.Email,
                Channel = NotificationChannel.Email,
                Subject = isRetraction
                    ? $"[CORRECTION] AEGIS Weather Advisory Retracted ({alert.District})"
                    : $"AEGIS Automated Weather Advisory: {alert.District} ({alert.TriggeredLevel})",
                Payload = NotificationFactory.EncodeDualPayload(plain, html),
                Status = NotificationStatus.Pending,
                Attempts = 0,
                NextAttemptAt = sendAt
            });
        }

        if (overflowed)
        {
            var health = await _context.ServiceHealths.FirstOrDefaultAsync(s => s.ServiceName.ToLower() == "email", ct);
            if (health == null)
            {
                _context.ServiceHealths.Add(new ServiceHealth
                {
                    ServiceName = "email",
                    Status = "Degraded",
                    Details = $"Email:DailyLimit ({dailyLimit}) reached; remaining alerts queued for next UTC day.",
                    LastCheckedAt = DateTime.UtcNow
                });
            }
            else
            {
                health.Status = "Degraded";
                health.Details = $"Email:DailyLimit ({dailyLimit}) reached; remaining alerts queued for next UTC day.";
                health.LastCheckedAt = DateTime.UtcNow;
            }
        }
    }

    private async Task<(string FactsJson, string ModelUsed, string PromptVersion, string En, string Si, string Ta)> BuildMessagesAsync(
        DistrictRiskSnapshot snap, string level, bool isReduced, CancellationToken ct)
    {
        var r24 = Math.Round(snap.Rainfall24hMm ?? 0, 1);
        var r72 = Math.Round(snap.Rainfall72hMm ?? 0, 1);
        var river = Math.Round(snap.RiverDischargeM3s ?? 0, 1);

        var factsJson = JsonSerializer.Serialize(new
        {
            district = snap.District,
            level,
            rainfall24hMm = r24,
            rainfall72hMm = r72,
            riverDischargeM3s = river,
            observedAtUtc = snap.DataUpdatedAtUtc.ToString("O"),
            source = "Open-Meteo"
        });

        var dmc = (_configuration["EmergencyContacts:Dmc"] ?? "117").Trim();
        var police = (_configuration["EmergencyContacts:Police"] ?? "119").Trim();
        var ambulance = (_configuration["EmergencyContacts:Ambulance"] ?? "1990").Trim();
        var contactsLine = $"DMC {dmc}, Police {police}, Ambulance {ambulance}";
        var allowedContacts = new[] { dmc, police, ambulance };
        var factNumbers = new[] { r24, r72, river };

        var groqKey = (_configuration["Groq:ApiKey"] ?? _configuration["Ai:ApiKey"])?.Trim().Trim('"');
        if (!string.IsNullOrWhiteSpace(groqKey))
        {
            var groqModel = (_configuration["Groq:Model"] ?? "llama-3.1-8b-instant").Trim();
            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
                var prompt = isReduced
                    ? $"Write a concise weather risk-reduced advisory in JSON with keys \"en\", \"si\", \"ta\" using ONLY these facts (do NOT invent any numbers): {factsJson}."
                    : $"Write a concise weather advisory in JSON with keys \"en\", \"si\", \"ta\" using ONLY these facts (do NOT invent any numbers): {factsJson}.";

                var payload = new
                {
                    model = groqModel,
                    temperature = 0.1,
                    response_format = new { type = "json_object" },
                    messages = new object[]
                    {
                        new { role = "system", content = "You write short factual humanitarian weather advisories in English (en), Sinhala (si), and Tamil (ta). Return strictly JSON {\"en\":\"...\",\"si\":\"...\",\"ta\":\"...\"}. Never invent numbers not present in the facts." },
                        new { role = "user", content = prompt }
                    }
                };
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", groqKey);
                req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                using var res = await http.SendAsync(req, ct);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                    var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
                    if (!string.IsNullOrWhiteSpace(content))
                    {
                        using var msgDoc = JsonDocument.Parse(content);
                        var enRaw = msgDoc.RootElement.GetProperty("en").GetString() ?? "";
                        var siRaw = msgDoc.RootElement.GetProperty("si").GetString() ?? "";
                        var taRaw = msgDoc.RootElement.GetProperty("ta").GetString() ?? "";

                        if (WeatherAlertLogic.ValidateNumbersInText(enRaw, factNumbers, allowedContacts)
                            && WeatherAlertLogic.ValidateNumbersInText(siRaw, factNumbers, allowedContacts)
                            && WeatherAlertLogic.ValidateNumbersInText(taRaw, factNumbers, allowedContacts))
                        {
                            var suffixEn = $" {WeatherAlertLogic.MandatoryDisclaimer} Emergency contacts: {contactsLine}";
                            var suffixSi = $" {WeatherAlertLogic.MandatoryDisclaimer} හදිසි අංක: {contactsLine}";
                            var suffixTa = $" {WeatherAlertLogic.MandatoryDisclaimer} அவசர எண்கள்: {contactsLine}";
                            return (factsJson, groqModel, PromptVersion, enRaw.Trim() + suffixEn, siRaw.Trim() + suffixSi, taRaw.Trim() + suffixTa);
                        }
                        _logger.LogWarning("Groq weather advisory rejected by number validator; falling back to templates.");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Groq weather advisory failed; falling back to fixed templates.");
            }
        }

        var (enT, siT, taT) = WeatherAlertLogic.BuildFixedTemplates(snap.District, level, r24, r72, river, contactsLine, isReduced);
        return (factsJson, "template", "template", enT, siT, taT);
    }

    private async Task<WeatherAlertRule> GetOrCreateDefaultRuleAsync(CancellationToken ct)
    {
        var rule = await _context.WeatherAlertRules.OrderBy(r => r.CreatedAt).FirstOrDefaultAsync(ct);
        if (rule != null) return rule;
        rule = new WeatherAlertRule();
        _context.WeatherAlertRules.Add(rule);
        await _context.SaveChangesAsync(ct);
        return rule;
    }

    private string GetSigningSecret() =>
        _configuration["Jwt:Key"] ?? _configuration["Security:UnsubscribeKey"] ?? "aegis-default-signing-key-change-in-prod";

    private static WeatherAlertRuleDto MapRule(WeatherAlertRule r) => new(
        r.Id, r.Name, r.Mode, r.TriggerLevels,
        r.Rainfall24hHighMm, r.Rainfall24hSevereMm, r.Rainfall72hHighMm, r.Rainfall72hSevereMm,
        r.RiverDischargeHighM3s, r.RiverDischargeSevereM3s, r.CooldownHours, r.HysteresisMargin,
        r.SendRiskReducedNotice, r.DailyAlertCapPerDistrict, r.MaxDataAgeMinutes,
        r.LastEvaluatedAtUtc, r.LastEvaluationStatus, r.UpdatedAt ?? r.CreatedAt);

    private static AutomatedAlertDto MapAlert(AutomatedAlert a) => new(
        a.Id, a.District, a.PreviousLevel, a.TriggeredLevel, a.AlertKind, a.Status, a.DedupeKey,
        a.TriggeringValuesJson, a.DataSource, a.DataTimestampUtc, a.ModelUsed, a.PromptVersion,
        a.MessageEn, a.MessageSi, a.MessageTa, a.RecipientCount,
        a.ApprovedById, a.ApprovedAtUtc, a.SentAtUtc, a.RetractedById, a.RetractedAtUtc, a.RetractionReason,
        a.IsFalseAlarm, a.FalseAlarmNotes, a.IsActive, a.CreatedAt);
}

public class WeatherAlertEvaluationWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WeatherAlertEvaluationWorker> _logger;

    public WeatherAlertEvaluationWorker(IServiceScopeFactory scopeFactory, ILogger<WeatherAlertEvaluationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var predictor = scope.ServiceProvider.GetService<IPredictionService>();
                if (predictor != null)
                {
                    await predictor.RefreshDistrictRiskAsync(stoppingToken);
                }
                var alerts = scope.ServiceProvider.GetRequiredService<IWeatherAlertService>();
                await alerts.EvaluateAfterRiskRefreshAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "WeatherAlertEvaluationWorker cycle failed.");
            }
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }
}

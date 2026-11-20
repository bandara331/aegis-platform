using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public record StockForecastOptions(
    int MinDataPoints = 3,
    double EwmaAlpha = 0.4,
    double HighRainfallThresholdMm = 25.0,
    double HighRainfallMultiplier = 1.35,
    double AlertThresholdHours = 12.0
);

public record StockForecastComputation(
    bool HasEnoughData,
    int DataPointsCount,
    double EwmaHourlyRate,
    double RainfallMultiplier,
    double? EstimatedHours,
    double? MinHours,
    double? MaxHours,
    bool AlertTriggered,
    string DisplayText
);

public static class StockForecastMath
{
    public static StockForecastComputation Compute(
        int quantityAvailable,
        IReadOnlyList<(DateTime DispatchedAtUtc, int Quantity)> allocations,
        double rainfall24hMm,
        StockForecastOptions opts)
    {
        if (allocations.Count < opts.MinDataPoints)
        {
            return new StockForecastComputation(
                false, allocations.Count, 0.0, 1.0, null, null, null, false, "not enough data");
        }

        var ordered = allocations.OrderBy(a => a.DispatchedAtUtc).ToList();
        var intervalRates = new List<double>();
        for (int i = 1; i < ordered.Count; i++)
        {
            var hours = Math.Max(0.25, (ordered[i].DispatchedAtUtc - ordered[i - 1].DispatchedAtUtc).TotalHours);
            intervalRates.Add(ordered[i].Quantity / hours);
        }

        if (intervalRates.Count == 0)
        {
            return new StockForecastComputation(
                false, allocations.Count, 0.0, 1.0, null, null, null, false, "not enough data");
        }

        // Exponentially Weighted Moving Average over interval hourly rates
        double ewma = intervalRates[0];
        for (int i = 1; i < intervalRates.Count; i++)
        {
            ewma = opts.EwmaAlpha * intervalRates[i] + (1.0 - opts.EwmaAlpha) * ewma;
        }

        if (ewma <= 0.0001)
        {
            return new StockForecastComputation(
                false, allocations.Count, 0.0, 1.0, null, null, null, false, "not enough data");
        }

        var multiplier = rainfall24hMm >= opts.HighRainfallThresholdMm ? opts.HighRainfallMultiplier : 1.0;
        var adjustedRate = ewma * multiplier;

        var mean = intervalRates.Average();
        var variance = intervalRates.Sum(r => Math.Pow(r - mean, 2)) / intervalRates.Count;
        var stdDev = Math.Sqrt(variance) * multiplier;

        var estHours = Math.Round(quantityAvailable / adjustedRate, 1);
        var lowRate = Math.Max(0.1 * adjustedRate, adjustedRate - stdDev);
        var highRate = adjustedRate + stdDev;

        var minHours = Math.Round(quantityAvailable / highRate, 1);
        var maxHours = Math.Round(quantityAvailable / lowRate, 1);

        var alertTriggered = estHours <= opts.AlertThresholdHours;
        var display = $"runs out in about {Math.Round(estHours)} h ({Math.Round(minHours)}-{Math.Round(maxHours)} h)";

        return new StockForecastComputation(
            true,
            allocations.Count,
            Math.Round(adjustedRate, 2),
            multiplier,
            estHours,
            minHours,
            maxHours,
            alertTriggered,
            display);
    }
}

public record DistrictRiskOptions(
    double Rainfall24hWeight = 0.30,
    double Rainfall72hWeight = 0.20,
    double RiverDischargeWeight = 0.20,
    double OfficialAlertWeight = 0.15,
    double OpenRequestDensityWeight = 0.15,
    double MediumThreshold = 25.0,
    double HighThreshold = 50.0,
    double SevereThreshold = 75.0,
    int StaleAfterMinutes = 90
);

public static class DistrictRiskMath
{
    public static (string RiskLevel, double RiskScore, List<RiskFactorDto> Factors) Compute(
        double? rainfall24hMm,
        double? rainfall72hMm,
        double? riverDischargeM3s,
        string officialAlertLevel,
        int openRequestsCount,
        DistrictRiskOptions opts,
        string weatherSource)
    {
        // Normalize each signal to 0-100 deterministically
        var r24Norm = rainfall24hMm.HasValue ? Math.Clamp((rainfall24hMm.Value / 100.0) * 100.0, 0, 100) : 0.0;
        var r72Norm = rainfall72hMm.HasValue ? Math.Clamp((rainfall72hMm.Value / 200.0) * 100.0, 0, 100) : 0.0;
        var riverNorm = riverDischargeM3s.HasValue ? Math.Clamp((riverDischargeM3s.Value / 500.0) * 100.0, 0, 100) : 0.0;
        var alertNorm = officialAlertLevel.ToLowerInvariant() switch
        {
            "critical" => 100.0,
            "warning" => 60.0,
            "info" => 25.0,
            _ => 0.0
        };
        var reqNorm = Math.Clamp((openRequestsCount / 20.0) * 100.0, 0, 100);

        var c1 = Math.Round(r24Norm * opts.Rainfall24hWeight, 1);
        var c2 = Math.Round(r72Norm * opts.Rainfall72hWeight, 1);
        var c3 = Math.Round(riverNorm * opts.RiverDischargeWeight, 1);
        var c4 = Math.Round(alertNorm * opts.OfficialAlertWeight, 1);
        var c5 = Math.Round(reqNorm * opts.OpenRequestDensityWeight, 1);

        var score = Math.Round(Math.Clamp(c1 + c2 + c3 + c4 + c5, 0, 100), 1);

        var level = score >= opts.SevereThreshold ? "Severe"
            : score >= opts.HighThreshold ? "High"
            : score >= opts.MediumThreshold ? "Medium"
            : "Low";

        var factors = new List<RiskFactorDto>
        {
            new("24h Rainfall", rainfall24hMm.HasValue ? $"{rainfall24hMm.Value:F1} mm" : "unavailable", weatherSource, c1),
            new("72h Rainfall", rainfall72hMm.HasValue ? $"{rainfall72hMm.Value:F1} mm" : "unavailable", weatherSource, c2),
            new("River Discharge", riverDischargeM3s.HasValue ? $"{riverDischargeM3s.Value:F1} m³/s" : "unavailable", "Open-Meteo Flood API", c3),
            new("Official NBRO/DMC Alert", officialAlertLevel, "Staff OfficialAlerts DB", c4),
            new("Open Request Density", $"{openRequestsCount} open requests", "AssistanceRequests DB", c5)
        };

        return (level, score, factors);
    }
}

public class PredictionService : IPredictionService
{
    public static readonly IReadOnlyDictionary<string, (double Lat, double Lon)> DistrictCentroids =
        new Dictionary<string, (double Lat, double Lon)>(StringComparer.OrdinalIgnoreCase)
        {
            ["Colombo"] = (6.9271, 79.8612),
            ["Gampaha"] = (7.0873, 79.9990),
            ["Kalutara"] = (6.5854, 79.9607),
            ["Kandy"] = (7.2906, 80.6337),
            ["Matale"] = (7.4675, 80.6234),
            ["Nuwara Eliya"] = (6.9497, 80.7891),
            ["Galle"] = (6.0535, 80.2210),
            ["Matara"] = (5.9549, 80.5550),
            ["Hambantota"] = (6.1241, 81.1185),
            ["Jaffna"] = (9.6615, 80.0255),
            ["Kilinochchi"] = (9.3803, 80.3770),
            ["Mannar"] = (8.9810, 79.9044),
            ["Vavuniya"] = (8.7514, 80.4971),
            ["Mullaitivu"] = (9.2671, 80.8142),
            ["Batticaloa"] = (7.7310, 81.6747),
            ["Ampara"] = (7.2975, 81.6820),
            ["Trincomalee"] = (8.5874, 81.2152),
            ["Kurunegala"] = (7.4863, 80.3623),
            ["Puttalam"] = (8.0408, 79.8394),
            ["Anuradhapura"] = (8.3114, 80.4037),
            ["Polonnaruwa"] = (7.9403, 81.0188),
            ["Badulla"] = (6.9934, 81.0550),
            ["Monaragala"] = (6.8728, 81.3507),
            ["Ratnapura"] = (6.6828, 80.3992),
            ["Kegalle"] = (7.2513, 80.3464)
        };

    private readonly AegisDbContext _context;
    private readonly IAuditService _audit;
    private readonly IRealtimeSignalPublisher? _signals;
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<PredictionService> _logger;

    public PredictionService(
        AegisDbContext context,
        IAuditService audit,
        HttpClient http,
        IConfiguration config,
        ILogger<PredictionService> logger,
        IRealtimeSignalPublisher? signals = null)
    {
        _context = context;
        _audit = audit;
        _http = http;
        _config = config;
        _logger = logger;
        _signals = signals;
    }

    private StockForecastOptions LoadForecastOptions() => new(
        MinDataPoints: _config.GetValue("Ai:Forecast:MinDataPoints", 3),
        EwmaAlpha: _config.GetValue("Ai:Forecast:EwmaAlpha", 0.4),
        HighRainfallThresholdMm: _config.GetValue("Ai:Forecast:HighRainfallThresholdMm", 25.0),
        HighRainfallMultiplier: _config.GetValue("Ai:Forecast:HighRainfallMultiplier", 1.35),
        AlertThresholdHours: _config.GetValue("Ai:Forecast:AlertThresholdHours", 12.0)
    );

    private DistrictRiskOptions LoadRiskOptions() => new(
        Rainfall24hWeight: _config.GetValue("Ai:Risk:Rainfall24hWeight", 0.30),
        Rainfall72hWeight: _config.GetValue("Ai:Risk:Rainfall72hWeight", 0.20),
        RiverDischargeWeight: _config.GetValue("Ai:Risk:RiverDischargeWeight", 0.20),
        OfficialAlertWeight: _config.GetValue("Ai:Risk:OfficialAlertWeight", 0.15),
        OpenRequestDensityWeight: _config.GetValue("Ai:Risk:OpenRequestDensityWeight", 0.15),
        MediumThreshold: _config.GetValue("Ai:Risk:MediumThreshold", 25.0),
        HighThreshold: _config.GetValue("Ai:Risk:HighThreshold", 50.0),
        SevereThreshold: _config.GetValue("Ai:Risk:SevereThreshold", 75.0),
        StaleAfterMinutes: _config.GetValue("Ai:Risk:StaleAfterMinutes", 90)
    );

    public async Task<IReadOnlyList<StockForecastDto>> GetStockForecastsAsync(CancellationToken cancellationToken = default)
    {
        var opts = LoadForecastOptions();
        var resources = await _context.Resources.AsNoTracking().ToListAsync(cancellationToken);
        if (resources.Count == 0) return [];

        var allocations = await _context.ResourceAllocations.AsNoTracking()
            .OrderBy(a => a.DispatchedAt)
            .ToListAsync(cancellationToken);

        var weatherByDistrict = await _context.WeatherSnapshots.AsNoTracking()
            .OrderByDescending(w => w.ObservedAt)
            .ToListAsync(cancellationToken);

        var results = new List<StockForecastDto>();
        var now = DateTime.UtcNow;

        foreach (var r in resources)
        {
            var rAllocs = allocations
                .Where(a => a.ResourceId == r.Id)
                .Select(a => (a.DispatchedAt, a.QuantityDispatched))
                .ToList();

            var latestWeather = weatherByDistrict.FirstOrDefault(w =>
                r.Depot.Contains(w.District, StringComparison.OrdinalIgnoreCase));
            var rain24h = latestWeather?.PrecipitationMm ?? 0.0;

            var comp = StockForecastMath.Compute(r.QuantityAvailable, rAllocs, rain24h, opts);
            var explanation = await PhraseForecastExplanationAsync(r, comp, cancellationToken);

            _context.StockForecastSnapshots.Add(new StockForecastSnapshot
            {
                ResourceId = r.Id,
                ItemName = r.ItemName,
                Category = r.Category,
                Depot = r.Depot,
                QuantityAvailable = r.QuantityAvailable,
                EwmaHourlyRate = comp.EwmaHourlyRate,
                EstimatedHours = comp.EstimatedHours,
                MinHours = comp.MinHours,
                MaxHours = comp.MaxHours,
                RainfallMultiplier = comp.RainfallMultiplier,
                HasEnoughData = comp.HasEnoughData,
                DataPointsCount = comp.DataPointsCount,
                AlertTriggered = comp.AlertTriggered,
                Explanation = explanation,
                ComputedAtUtc = now
            });

            if (comp.AlertTriggered)
            {
                var recentAlertExists = await _context.OfficialAlerts.AsNoTracking()
                    .AnyAsync(a => !a.IsExpired && a.Title.Contains(r.ItemName) && a.IssuedAtUtc >= now.AddHours(-6), cancellationToken);
                if (!recentAlertExists)
                {
                    _context.OfficialAlerts.Add(new OfficialAlert
                    {
                        Title = $"Low Stock Forecast: {r.ItemName} ({r.Depot})",
                        Message = $"{r.ItemName} at {r.Depot} {comp.DisplayText}. Available: {r.QuantityAvailable} {r.Unit}.",
                        District = r.Depot,
                        Severity = "Warning",
                        Language = "en",
                        IssuedById = "SystemPrediction",
                        IssuedAtUtc = now,
                        ExpiresAtUtc = now.AddHours(12)
                    });
                }

                if (_signals != null)
                {
                    await _signals.PublishAsync("stock.low_forecast", new
                    {
                        r.Id,
                        r.ItemName,
                        r.Depot,
                        comp.DisplayText,
                        comp.EstimatedHours
                    }, cancellationToken);
                }
            }

            results.Add(new StockForecastDto(
                r.Id, r.ItemName, r.Category, r.Depot, r.QuantityAvailable, r.Unit,
                comp.HasEnoughData, comp.DataPointsCount, comp.EwmaHourlyRate, comp.RainfallMultiplier,
                comp.EstimatedHours, comp.MinHours, comp.MaxHours, comp.AlertTriggered,
                comp.DisplayText, explanation, now));
        }

        await _context.SaveChangesAsync(cancellationToken);
        return results;
    }

    public async Task<DistrictRiskResponseDto> GetDistrictRiskAsync(CancellationToken cancellationToken = default)
    {
        var opts = LoadRiskOptions();
        var existing = await _context.DistrictRiskSnapshots.AsNoTracking()
            .OrderByDescending(d => d.ComputedAtUtc)
            .ToListAsync(cancellationToken);

        if (existing.Count == 0)
        {
            return await RefreshDistrictRiskAsync(cancellationToken);
        }

        var latestBatch = existing
            .GroupBy(d => d.District, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(x => x.ComputedAtUtc).First())
            .ToList();

        var now = DateTime.UtcNow;
        var dtos = latestBatch.Select(s =>
        {
            var isStale = s.IsStale || (now - s.DataUpdatedAtUtc).TotalMinutes > opts.StaleAfterMinutes;
            var factors = JsonSerializer.Deserialize<List<RiskFactorDto>>(s.FactorsJson) ?? [];
            return new DistrictRiskDto(
                s.District, s.Latitude, s.Longitude, s.RiskLevel, s.RiskScore,
                s.AdvisoryNotice, s.DataUpdatedAtUtc, isStale, factors);
        }).OrderByDescending(d => d.RiskScore).ToList();

        var lastUpdated = dtos.Max(d => d.LastUpdatedUtc);
        return new DistrictRiskResponseDto("advisory, not official", lastUpdated, dtos.Any(d => d.IsStale), dtos);
    }

    public static string FindNearestDistrict(double lat, double lon)
    {
        var best = "Colombo";
        var bestDist = double.MaxValue;
        foreach (var kv in DistrictCentroids)
        {
            var dLat = kv.Value.Lat - lat;
            var dLon = kv.Value.Lon - lon;
            var dist = (dLat * dLat) + (dLon * dLon);
            if (dist < bestDist)
            {
                bestDist = dist;
                best = kv.Key;
            }
        }
        return best;
    }

    public async Task<DistrictRiskResponseDto> RefreshDistrictRiskAsync(CancellationToken cancellationToken = default)
    {
        var opts = LoadRiskOptions();
        var now = DateTime.UtcNow;

        // Collect districts that have real DB activity (open requests, active alerts, or shelters)
        var reqDistricts = await _context.AssistanceRequests.AsNoTracking()
            .Select(r => r.Area)
            .Distinct()
            .ToListAsync(cancellationToken);
        var alertDistricts = await _context.OfficialAlerts.AsNoTracking()
            .Where(a => !a.IsExpired)
            .Select(a => a.District)
            .Distinct()
            .ToListAsync(cancellationToken);
        var optedInDistricts = await _context.Users.AsNoTracking()
            .Where(u => u.AlertOptIn && u.EmailConfirmed && u.IsEnabled && u.District != null)
            .Select(u => u.District!)
            .Distinct()
            .ToListAsync(cancellationToken);

        var activeDistricts = reqDistricts
            .Concat(alertDistricts)
            .Concat(optedInDistricts)
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(d => DistrictCentroids.ContainsKey(d))
            .ToList();

        if (activeDistricts.Count == 0)
        {
            return new DistrictRiskResponseDto("advisory, not official", now, false, []);
        }

        var openRequests = await _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.Status != RequestStatus.Fulfilled && r.Status != RequestStatus.Closed && r.Status != RequestStatus.Cancelled && r.Status != RequestStatus.Rejected)
            .ToListAsync(cancellationToken);

        var activeAlerts = await _context.OfficialAlerts.AsNoTracking()
            .Where(a => !a.IsExpired && (a.ExpiresAtUtc == null || a.ExpiresAtUtc > now))
            .ToListAsync(cancellationToken);

        var dtos = new List<DistrictRiskDto>();

        foreach (var district in activeDistricts)
        {
            var (lat, lon) = DistrictCentroids[district];
            var (r24, r72, river, fetchedAt, isStale, weatherSource) = await FetchOpenMeteoOrFallbackAsync(district, lat, lon, opts, cancellationToken);

            var distAlert = activeAlerts
                .Where(a => a.District.Equals(district, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(a => a.Severity == "Critical" ? 3 : a.Severity == "Warning" ? 2 : 1)
                .FirstOrDefault()?.Severity ?? "None";

            var openCount = openRequests.Count(r => r.Area.Equals(district, StringComparison.OrdinalIgnoreCase));

            var (level, score, factors) = DistrictRiskMath.Compute(r24, r72, river, distAlert, openCount, opts, weatherSource);

            var snap = new DistrictRiskSnapshot
            {
                District = district,
                Latitude = lat,
                Longitude = lon,
                RiskLevel = level,
                RiskScore = score,
                Rainfall24hMm = r24,
                Rainfall72hMm = r72,
                RiverDischargeM3s = river,
                OfficialAlertLevel = distAlert,
                OpenRequestsCount = openCount,
                FactorsJson = JsonSerializer.Serialize(factors),
                DataUpdatedAtUtc = fetchedAt,
                ComputedAtUtc = now,
                IsStale = isStale,
                AdvisoryNotice = "advisory, not official"
            };
            _context.DistrictRiskSnapshots.Add(snap);

            dtos.Add(new DistrictRiskDto(
                district, lat, lon, level, score, "advisory, not official", fetchedAt, isStale, factors));
        }

        await _context.SaveChangesAsync(cancellationToken);
        var sorted = dtos.OrderByDescending(d => d.RiskScore).ToList();
        return new DistrictRiskResponseDto("advisory, not official", now, sorted.Any(d => d.IsStale), sorted);
    }

    private async Task<(double? r24, double? r72, double? river, DateTime updatedAt, bool isStale, string source)> FetchOpenMeteoOrFallbackAsync(
        string district, double lat, double lon, DistrictRiskOptions opts, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        try
        {
            var weatherUrl = $"https://api.open-meteo.com/v1/forecast?latitude={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}&longitude={lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}&hourly=precipitation&forecast_days=3";
            var floodUrl = $"https://flood-api.open-meteo.com/v1/flood?latitude={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}&longitude={lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}&daily=river_discharge&forecast_days=1";

            double? r24 = null;
            double? r72 = null;
            double? river = null;

            using var wRes = await _http.GetAsync(weatherUrl, ct);
            if (wRes.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await wRes.Content.ReadAsStringAsync(ct));
                if (doc.RootElement.TryGetProperty("hourly", out var hourly) &&
                    hourly.TryGetProperty("precipitation", out var precipArr) &&
                    precipArr.ValueKind == JsonValueKind.Array)
                {
                    var vals = precipArr.EnumerateArray()
                        .Where(x => x.ValueKind == JsonValueKind.Number)
                        .Select(x => x.GetDouble())
                        .ToList();
                    if (vals.Count > 0)
                    {
                        r24 = Math.Round(vals.Take(24).Sum(), 1);
                        r72 = Math.Round(vals.Take(72).Sum(), 1);
                    }
                }
            }

            using var fRes = await _http.GetAsync(floodUrl, ct);
            if (fRes.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await fRes.Content.ReadAsStringAsync(ct));
                if (doc.RootElement.TryGetProperty("daily", out var daily) &&
                    daily.TryGetProperty("river_discharge", out var rdArr) &&
                    rdArr.ValueKind == JsonValueKind.Array)
                {
                    var first = rdArr.EnumerateArray().FirstOrDefault();
                    if (first.ValueKind == JsonValueKind.Number) river = Math.Round(first.GetDouble(), 2);
                }
            }

            if (r24.HasValue)
            {
                _context.WeatherSnapshots.Add(new WeatherSnapshot
                {
                    District = district,
                    Summary = $"Open-Meteo 24h={r24}mm, 72h={r72}mm",
                    PrecipitationMm = r24,
                    Severity = r24 >= 50 ? "High" : r24 >= 25 ? "Moderate" : "Normal",
                    ObservedAt = now
                });
                return (r24, r72, river, now, false, "Open-Meteo Live");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Open-Meteo fetch failed for district={District}; checking stored WeatherSnapshots.", district);
        }

        var stored = await _context.WeatherSnapshots.AsNoTracking()
            .Where(w => w.District.Equals(district, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(w => w.ObservedAt)
            .FirstOrDefaultAsync(ct);

        if (stored != null)
        {
            var stale = (now - stored.ObservedAt).TotalMinutes > opts.StaleAfterMinutes;
            return (stored.PrecipitationMm, null, null, stored.ObservedAt, stale, "Stored WeatherSnapshot");
        }

        return (null, null, null, now, true, "No weather data");
    }

    private async Task<string> PhraseForecastExplanationAsync(Resource r, StockForecastComputation comp, CancellationToken ct)
    {
        if (!comp.HasEnoughData)
        {
            return $"Fewer than minimum allocation data points ({comp.DataPointsCount}) recorded for {r.ItemName} at {r.Depot}; cannot forecast stockout.";
        }

        var deterministic = $"{r.ItemName} at {r.Depot} has {r.QuantityAvailable} {r.Unit} remaining, consuming ~{comp.EwmaHourlyRate:F2} {r.Unit}/h" +
                            (comp.RainfallMultiplier > 1.0 ? $" (including {comp.RainfallMultiplier:F2}x rainfall multiplier)" : "") +
                            $" and {comp.DisplayText}.";

        var apiKey = _config["Groq:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) return deterministic;

        try
        {
            var model = _config["Groq:Model"] ?? "openai/gpt-oss-20b";
            var body = new
            {
                model,
                temperature = 0.1,
                messages = new[]
                {
                    new { role = "system", content = "Rephrase the following deterministic stock forecast in one clear, factual sentence for a relief coordinator. Do not change or invent any numbers." },
                    new { role = "user", content = deterministic }
                }
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return deterministic;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var phrased = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            return string.IsNullOrWhiteSpace(phrased) ? deterministic : phrased.Trim();
        }
        catch
        {
            return deterministic;
        }
    }
}

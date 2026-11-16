using System.Text.Json;
using Aegis.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Mapping & Routing integration using OSRM HTTP API wrapped with Polly resilience and Haversine fallback.
/// </summary>
public class OsrmRoutingService : IRoutingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OsrmRoutingService> _logger;

    public OsrmRoutingService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<OsrmRoutingService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<(double DistanceKm, int DurationMinutes, string Source)> GetRouteAsync(
        double fromLat,
        double fromLon,
        double toLat,
        double toLon,
        CancellationToken cancellationToken = default)
    {
        var baseUrl = _configuration["Routing:BaseUrl"] ?? "https://router.project-osrm.org";
        var enableRemote = bool.TryParse(_configuration["Routing:EnableRemote"], out var en) && en;

        if (enableRemote)
        {
            try
            {
                // OSRM format: /route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false
                var url = $"{baseUrl.TrimEnd('/')}/route/v1/driving/{fromLon:F5},{fromLat:F5};{toLon:F5},{toLat:F5}?overview=false";
                using var response = await _httpClient.GetAsync(url, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
                    if (doc.RootElement.TryGetProperty("routes", out var routes) && routes.GetArrayLength() > 0)
                    {
                        var first = routes[0];
                        var distMeters = first.GetProperty("distance").GetDouble();
                        var durationSec = first.GetProperty("duration").GetDouble();
                        return (Math.Round(distMeters / 1000.0, 2), Math.Max(1, (int)Math.Ceiling(durationSec / 60.0)), "OSRM");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OSRM routing call failed; falling back to Haversine calculation.");
            }
        }

        var (fallbackKm, fallbackMin) = CalculateHaversineFallback(fromLat, fromLon, toLat, toLon);
        return (fallbackKm, fallbackMin, "HaversineFallback");
    }

    public (double DistanceKm, int DurationMinutes) CalculateHaversineFallback(
        double fromLat,
        double fromLon,
        double toLat,
        double toLon)
    {
        const double earthRadiusKm = 6371.0;
        var dLat = (toLat - fromLat) * Math.PI / 180.0;
        var dLon = (toLon - fromLon) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(fromLat * Math.PI / 180.0) * Math.Cos(toLat * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        var straightLineKm = earthRadiusKm * c;

        // Apply 1.3x road winding factor and 35 km/h average crisis driving speed
        var roadDistanceKm = Math.Round(straightLineKm * 1.3, 2);
        var durationMin = Math.Max(2, (int)Math.Ceiling((roadDistanceKm / 35.0) * 60.0));
        return (roadDistanceKm, durationMin);
    }
}

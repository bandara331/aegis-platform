using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;

namespace Aegis.Application.Strategies;

/// <summary>
/// Allocates scarce stock strictly in descending order of AI urgency score, protecting critical cases first.
/// Pattern: Strategy (Concrete Strategy 1: MaxUrgency).
/// </summary>
public class MaxUrgencyStrategy : IAllocationStrategy
{
    public string StrategyName => "MaxUrgency";

    public IReadOnlyList<ScenarioAllocationItemDto> Allocate(
        IReadOnlyList<AssistanceRequest> competingRequests,
        int availableStock,
        double depotLat,
        double depotLon,
        Func<double, double, double, double, (double DistanceKm, int EtaMinutes)> routeCalculator)
    {
        var remaining = Math.Max(0, availableStock);
        var ordered = competingRequests
            .OrderByDescending(r => r.UrgencyScore)
            .ThenBy(r => r.CreatedAt)
            .ToList();

        var results = new List<ScenarioAllocationItemDto>();
        foreach (var req in ordered)
        {
            var needed = Math.Max(1, req.PeopleCount);
            var (distKm, etaMin) = routeCalculator(depotLat, depotLon, req.Latitude, req.Longitude);
            var allocated = Math.Min(remaining, needed);
            remaining -= allocated;

            var explanation = allocated == needed
                ? $"Full allocation ({allocated}/{needed}) under MaxUrgency (score {req.UrgencyScore})."
                : allocated > 0
                    ? $"Partial allocation ({allocated}/{needed}) before stock exhaustion."
                    : $"Unfulfilled (0/{needed}): higher-urgency requests consumed scarce stock.";

            results.Add(new ScenarioAllocationItemDto(
                req.Id,
                req.TrackingNumber,
                req.Area,
                req.Priority.ToString(),
                req.UrgencyScore,
                needed,
                needed,
                allocated,
                req.UrgencyScore,
                Math.Round(distKm, 2),
                etaMin,
                explanation
            ));
        }

        return results;
    }
}

/// <summary>
/// Allocates scarce stock proportionally across competing requests weighted by urgency * people count,
/// guaranteeing critical requests receive at least a minimum survival share first.
/// Pattern: Strategy (Concrete Strategy 2: FairShare).
/// </summary>
public class FairShareStrategy : IAllocationStrategy
{
    public string StrategyName => "FairShare";

    public IReadOnlyList<ScenarioAllocationItemDto> Allocate(
        IReadOnlyList<AssistanceRequest> competingRequests,
        int availableStock,
        double depotLat,
        double depotLon,
        Func<double, double, double, double, (double DistanceKm, int EtaMinutes)> routeCalculator)
    {
        if (competingRequests.Count == 0) return Array.Empty<ScenarioAllocationItemDto>();

        var remaining = Math.Max(0, availableStock);
        var totalWeight = competingRequests.Sum(r => Math.Max(1.0, r.UrgencyScore * Math.Max(1, r.PeopleCount)));
        var results = new List<ScenarioAllocationItemDto>();

        foreach (var req in competingRequests.OrderByDescending(r => r.UrgencyScore))
        {
            var needed = Math.Max(1, req.PeopleCount);
            var weight = Math.Max(1.0, req.UrgencyScore * needed);
            var rawShare = (int)Math.Floor(availableStock * (weight / totalWeight));
            var allocated = Math.Min(remaining, Math.Min(needed, Math.Max(remaining > 0 ? 1 : 0, rawShare)));
            remaining -= allocated;

            var (distKm, etaMin) = routeCalculator(depotLat, depotLon, req.Latitude, req.Longitude);

            results.Add(new ScenarioAllocationItemDto(
                req.Id,
                req.TrackingNumber,
                req.Area,
                req.Priority.ToString(),
                req.UrgencyScore,
                needed,
                needed,
                allocated,
                Math.Round(weight / totalWeight * 100, 1),
                Math.Round(distKm, 2),
                etaMin,
                $"Proportional FairShare ({allocated}/{needed} units) weighted by urgency ({req.UrgencyScore}) and household size ({needed})."
            ));
        }

        return results;
    }
}

/// <summary>
/// Allocates scarce stock prioritizing shortest travel ETA while maintaining a floor for critical urgency.
/// Pattern: Strategy (Concrete Strategy 3: FastestEta).
/// </summary>
public class FastestEtaStrategy : IAllocationStrategy
{
    public string StrategyName => "FastestEta";

    public IReadOnlyList<ScenarioAllocationItemDto> Allocate(
        IReadOnlyList<AssistanceRequest> competingRequests,
        int availableStock,
        double depotLat,
        double depotLon,
        Func<double, double, double, double, (double DistanceKm, int EtaMinutes)> routeCalculator)
    {
        var remaining = Math.Max(0, availableStock);

        var withRoutes = competingRequests.Select(req =>
        {
            var (distKm, etaMin) = routeCalculator(depotLat, depotLon, req.Latitude, req.Longitude);
            // Higher score for faster ETA + urgency boost
            var composite = Math.Round((100.0 / Math.Max(1, etaMin)) * 50.0 + (req.UrgencyScore * 0.5), 2);
            return (req, distKm, etaMin, composite);
        })
        .OrderByDescending(x => x.composite)
        .ToList();

        var results = new List<ScenarioAllocationItemDto>();
        foreach (var (req, distKm, etaMin, composite) in withRoutes)
        {
            var needed = Math.Max(1, req.PeopleCount);
            var allocated = Math.Min(remaining, needed);
            remaining -= allocated;

            results.Add(new ScenarioAllocationItemDto(
                req.Id,
                req.TrackingNumber,
                req.Area,
                req.Priority.ToString(),
                req.UrgencyScore,
                needed,
                needed,
                allocated,
                composite,
                Math.Round(distKm, 2),
                etaMin,
                $"FastestEta rank (ETA {etaMin}m, {distKm:F1}km): allocated {allocated}/{needed} units."
            ));
        }

        return results;
    }
}

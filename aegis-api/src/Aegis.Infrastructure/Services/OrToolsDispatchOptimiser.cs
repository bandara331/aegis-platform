using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Google.OrTools.ConstraintSolver;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public class OrToolsDispatchOptimiser : IDispatchOptimiser
{
    public string StrategyName => "OrToolsCVRP";

    private readonly AegisDbContext _context;
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<OrToolsDispatchOptimiser> _logger;

    public OrToolsDispatchOptimiser(
        AegisDbContext context,
        HttpClient http,
        IConfiguration config,
        ILogger<OrToolsDispatchOptimiser> logger)
    {
        _context = context;
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<Result<DispatchPlanDto>> OptimizeAsync(
        DispatchPlanRequestDto input,
        string createdById,
        CancellationToken cancellationToken = default)
    {
        var maxStops = _config.GetValue("Ai:Dispatch:MaxStops", 50);
        var maxVehicles = _config.GetValue("Ai:Dispatch:MaxVehicles", 15);
        var timeLimitSec = Math.Clamp(_config.GetValue("Ai:Dispatch:TimeLimitSeconds", 6), 5, 10);

        var vehicleQuery = _context.Vehicles.AsNoTracking()
            .Where(v => v.Availability == "Available" && v.Capacity > 0);
        if (input.VehicleIds is { Count: > 0 })
            vehicleQuery = vehicleQuery.Where(v => input.VehicleIds.Contains(v.Id));
        var vehicles = await vehicleQuery.OrderByDescending(v => v.Capacity).ToListAsync(cancellationToken);

        var reqQuery = _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.Status == RequestStatus.Approved || r.Status == RequestStatus.Submitted || r.Status == RequestStatus.ManualTriage || r.Status == RequestStatus.NeedsReview);
        if (input.RequestIds is { Count: > 0 })
            reqQuery = reqQuery.Where(r => input.RequestIds.Contains(r.Id));
        var stops = await reqQuery.OrderByDescending(r => r.Priority).ThenBy(r => r.CreatedAt).ToListAsync(cancellationToken);

        if (vehicles.Count == 0)
            return Result<DispatchPlanDto>.Failure("No available vehicles registered. Add vehicles before generating a dispatch plan.");
        if (stops.Count == 0)
            return Result<DispatchPlanDto>.Failure("No pending or approved assistance requests available to dispatch.");
        if (stops.Count > maxStops)
            return Result<DispatchPlanDto>.Failure($"Too many stops ({stops.Count}). Maximum supported per optimization run is {maxStops}.");
        if (vehicles.Count > maxVehicles)
            return Result<DispatchPlanDto>.Failure($"Too many vehicles ({vehicles.Count}). Maximum supported per optimization run is {maxVehicles}.");

        // Build node list: [0..V-1] = vehicle start depots, [V..V+S-1] = request stops, [V+S] = virtual zero-cost sink
        int vCount = vehicles.Count;
        int sCount = stops.Count;
        int sinkNode = vCount + sCount;
        int totalNodes = sinkNode + 1;

        var coords = new List<(double Lat, double Lon)>(totalNodes);
        foreach (var v in vehicles) coords.Add((v.CurrentLatitude, v.CurrentLongitude));
        foreach (var s in stops) coords.Add((s.Latitude, s.Longitude));
        coords.Add((0, 0)); // virtual sink

        var (durMin, distKm, routingSource, isEstimated) = await BuildTravelMatrixAsync(coords, sinkNode, cancellationToken);

        // OR-Tools RoutingIndexManager with distinct vehicle starts and shared virtual sink end
        var starts = Enumerable.Range(0, vCount).ToArray();
        var ends = Enumerable.Repeat(sinkNode, vCount).ToArray();
        var manager = new RoutingIndexManager(totalNodes, vCount, starts, ends);
        var routing = new RoutingModel(manager);

        int transitCallbackIndex = routing.RegisterTransitCallback((long fromIndex, long toIndex) =>
        {
            int fromNode = manager.IndexToNode(fromIndex);
            int toNode = manager.IndexToNode(toIndex);
            return (long)Math.Round(durMin[fromNode, toNode] * 10); // tenths of a minute for precision
        });
        routing.SetArcCostEvaluatorOfAllVehicles(transitCallbackIndex);

        // Capacity constraint (PeopleCount vs Vehicle.Capacity)
        int demandCallbackIndex = routing.RegisterUnaryTransitCallback((long fromIndex) =>
        {
            int node = manager.IndexToNode(fromIndex);
            if (node < vCount || node == sinkNode) return 0;
            return Math.Max(1, stops[node - vCount].PeopleCount);
        });
        long[] capacities = vehicles.Select(v => (long)Math.Max(1, v.Capacity)).ToArray();
        routing.AddDimensionWithVehicleCapacity(demandCallbackIndex, 0, capacities, true, "Capacity");

        // Time dimension with priority-based soft time windows
        routing.AddDimension(transitCallbackIndex, 600, 14400, true, "Time");
        var timeDim = routing.GetMutableDimension("Time");

        // Priority-weighted disjunctions so Critical stops are most expensive to drop
        for (int i = 0; i < sCount; i++)
        {
            int node = vCount + i;
            long index = manager.NodeToIndex(node);
            var req = stops[i];
            long penalty = req.Priority switch
            {
                RequestPriority.Critical => 1_000_000,
                RequestPriority.High => 250_000,
                RequestPriority.Medium => 50_000,
                _ => 10_000
            };
            routing.AddDisjunction(new long[] { index }, penalty);

            long softUpperTenths = req.Priority switch
            {
                RequestPriority.Critical => 600,  // 60 min
                RequestPriority.High => 1200,     // 120 min
                RequestPriority.Medium => 2400,   // 240 min
                _ => 3600                         // 360 min
            };
            timeDim.SetCumulVarSoftUpperBound(index, softUpperTenths, 5);
        }

        var searchParams = operations_research_constraint_solver.DefaultRoutingSearchParameters();
        searchParams.FirstSolutionStrategy = FirstSolutionStrategy.Types.Value.PathCheapestArc;
        searchParams.LocalSearchMetaheuristic = LocalSearchMetaheuristic.Types.Value.GuidedLocalSearch;
        searchParams.TimeLimit = new Google.Protobuf.WellKnownTypes.Duration { Seconds = timeLimitSec };

        var solution = routing.SolveWithParameters(searchParams);
        if (solution == null)
            return Result<DispatchPlanDto>.Failure("OR-Tools solver could not find a feasible dispatch plan within the time limit.");

        var routes = new List<DispatchVehicleRouteDto>();
        var servedRequestIds = new HashSet<Guid>();
        double totalDistanceKm = 0;
        double totalDurationMin = 0;
        bool hasCriticalStop = false;

        for (int vIdx = 0; vIdx < vCount; vIdx++)
        {
            var v = vehicles[vIdx];
            var routeStops = new List<DispatchStopDto>();
            var polylinePoints = new List<(double Lat, double Lon)> { (v.CurrentLatitude, v.CurrentLongitude) };

            long index = routing.Start(vIdx);
            int prevNode = manager.IndexToNode(index);
            double cumDist = 0;
            double cumDur = 0;
            int load = 0;
            int seq = 1;

            while (!routing.IsEnd(index))
            {
                long nextIndex = solution.Value(routing.NextVar(index));
                int nextNode = manager.IndexToNode(nextIndex);
                if (nextNode >= vCount && nextNode < sinkNode)
                {
                    var req = stops[nextNode - vCount];
                    double legDist = distKm[prevNode, nextNode];
                    double legDur = durMin[prevNode, nextNode];
                    cumDist += legDist;
                    cumDur += legDur;
                    load += Math.Max(1, req.PeopleCount);
                    servedRequestIds.Add(req.Id);
                    if (req.Priority == RequestPriority.Critical) hasCriticalStop = true;

                    polylinePoints.Add((req.Latitude, req.Longitude));
                    routeStops.Add(new DispatchStopDto(
                        req.Id, req.TrackingNumber, req.Area, req.Category, req.Priority.ToString(),
                        req.PeopleCount, req.Latitude, req.Longitude, seq++, Math.Round(cumDur, 1), Math.Round(legDist, 2)));
                    prevNode = nextNode;
                }
                index = nextIndex;
            }

            if (routeStops.Count > 0)
            {
                totalDistanceKm += cumDist;
                totalDurationMin += cumDur;
                var encodedPoly = await GetRoutePolylineAsync(polylinePoints, cancellationToken);
                routes.Add(new DispatchVehicleRouteDto(
                    v.Id, v.Name, v.VehicleType, v.AssignedDriverName ?? "Unassigned Driver",
                    routeStops.Count, load, v.Capacity, Math.Round(cumDist, 2), Math.Round(cumDur, 1),
                    encodedPoly, routeStops));
            }
        }

        // Unserved stops with clear deterministic reason
        int maxVehicleCap = vehicles.Max(v => v.Capacity);
        var unserved = new List<UnservedStopDto>();
        foreach (var req in stops)
        {
            if (servedRequestIds.Contains(req.Id)) continue;
            var reason = req.PeopleCount > maxVehicleCap
                ? $"People count ({req.PeopleCount}) exceeds largest available vehicle capacity ({maxVehicleCap})."
                : "Dropped due to fleet capacity / time-window constraints in favor of higher-priority stops.";
            unserved.Add(new UnservedStopDto(req.Id, req.TrackingNumber, req.Priority.ToString(), req.PeopleCount, reason));
        }

        double baselineMin = ComputeNearestVehicleBaselineMinutes(vehicles, stops, durMin, vCount);
        double minutesSaved = Math.Round(Math.Max(0, baselineMin - totalDurationMin), 1);

        var explanation = await BuildExplanationAsync(routes.Count, servedRequestIds.Count, unserved.Count, minutesSaved, routingSource, cancellationToken);

        var plan = new DispatchPlan
        {
            Status = "Preview",
            RoutesJson = JsonSerializer.Serialize(routes),
            UnservedJson = JsonSerializer.Serialize(unserved),
            TotalDistanceKm = Math.Round(totalDistanceKm, 2),
            TotalDurationMinutes = Math.Round(totalDurationMin, 1),
            BaselineDurationMinutes = Math.Round(baselineMin, 1),
            MinutesSaved = minutesSaved,
            RoutingSource = routingSource,
            IsEstimated = isEstimated,
            RequiresSecondApprover = hasCriticalStop,
            Explanation = explanation,
            CreatedById = createdById
        };

        _context.DispatchPlans.Add(plan);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<DispatchPlanDto>.Success(new DispatchPlanDto(
            plan.Id, plan.Status, plan.RoutingSource, plan.IsEstimated,
            plan.TotalDistanceKm, plan.TotalDurationMinutes, plan.BaselineDurationMinutes, plan.MinutesSaved,
            plan.RequiresSecondApprover, plan.Explanation, routes, unserved, plan.CreatedAt));
    }

    private static double ComputeNearestVehicleBaselineMinutes(
        List<Vehicle> vehicles, List<AssistanceRequest> stops, double[,] durMin, int vCount)
    {
        var remCap = vehicles.Select(v => v.Capacity).ToArray();
        var lastNode = Enumerable.Range(0, vCount).ToArray();
        double total = 0;

        foreach (var (req, idx) in stops.Select((s, i) => (s, i)))
        {
            int stopNode = vCount + idx;
            int demand = Math.Max(1, req.PeopleCount);
            int bestV = -1;
            double bestDur = double.MaxValue;

            for (int v = 0; v < vCount; v++)
            {
                if (remCap[v] >= demand && durMin[lastNode[v], stopNode] < bestDur)
                {
                    bestDur = durMin[lastNode[v], stopNode];
                    bestV = v;
                }
            }

            if (bestV >= 0)
            {
                remCap[bestV] -= demand;
                lastNode[bestV] = stopNode;
                total += bestDur;
            }
        }
        return total;
    }

    private async Task<(double[,] durMin, double[,] distKm, string source, bool isEstimated)> BuildTravelMatrixAsync(
        List<(double Lat, double Lon)> coords, int sinkNode, CancellationToken ct)
    {
        int n = coords.Count;
        var dur = new double[n, n];
        var dist = new double[n, n];

        // Fill Haversine baseline first (35 km/h urban relief speed)
        for (int i = 0; i < n; i++)
        {
            for (int j = 0; j < n; j++)
            {
                if (i == j || i == sinkNode || j == sinkNode)
                {
                    dur[i, j] = 0;
                    dist[i, j] = 0;
                }
                else
                {
                    var km = HaversineKm(coords[i].Lat, coords[i].Lon, coords[j].Lat, coords[j].Lon);
                    dist[i, j] = km;
                    dur[i, j] = (km / 35.0) * 60.0;
                }
            }
        }

        var apiKey = _config["GoogleRoutes:ApiKey"] ?? _config["GoogleMaps:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || sinkNode > 25)
        {
            return (dur, dist, "Haversine (estimated)", true);
        }

        try
        {
            var waypoints = coords.Take(sinkNode).Select(c => new
            {
                waypoint = new { location = new { latLng = new { latitude = c.Lat, longitude = c.Lon } } }
            }).ToArray();

            var body = new
            {
                origins = waypoints,
                destinations = waypoints,
                travelMode = "DRIVE",
                routingPreference = "TRAFFIC_AWARE"
            };

            using var req = new HttpRequestMessage(HttpMethod.Post, "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix");
            req.Headers.Add("X-Goog-Api-Key", apiKey);
            req.Headers.Add("X-Goog-FieldMask", "originIndex,destinationIndex,duration,distanceMeters,condition");
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return (dur, dist, "Haversine (estimated)", true);

            var raw = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return (dur, dist, "Haversine (estimated)", true);

            foreach (var el in doc.RootElement.EnumerateArray())
            {
                int oi = el.GetProperty("originIndex").GetInt32();
                int di = el.GetProperty("destinationIndex").GetInt32();
                if (el.TryGetProperty("distanceMeters", out var dm) && dm.ValueKind == JsonValueKind.Number)
                    dist[oi, di] = dm.GetDouble() / 1000.0;
                if (el.TryGetProperty("duration", out var durProp) && durProp.ValueKind == JsonValueKind.String)
                {
                    var s = durProp.GetString()?.TrimEnd('s');
                    if (double.TryParse(s, System.Globalization.CultureInfo.InvariantCulture, out var secs))
                        dur[oi, di] = secs / 60.0;
                }
            }
            return (dur, dist, "Google Routes computeRouteMatrix", false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google Routes computeRouteMatrix failed; falling back to Haversine.");
            return (dur, dist, "Haversine (estimated)", true);
        }
    }

    private async Task<string> GetRoutePolylineAsync(List<(double Lat, double Lon)> points, CancellationToken ct)
    {
        var apiKey = _config["GoogleRoutes:ApiKey"] ?? _config["GoogleMaps:ApiKey"];
        if (!string.IsNullOrWhiteSpace(apiKey) && points.Count >= 2)
        {
            try
            {
                var body = new
                {
                    origin = new { location = new { latLng = new { latitude = points[0].Lat, longitude = points[0].Lon } } },
                    destination = new { location = new { latLng = new { latitude = points[^1].Lat, longitude = points[^1].Lon } } },
                    intermediates = points.Skip(1).Take(points.Count - 2).Select(p => new
                    {
                        location = new { latLng = new { latitude = p.Lat, longitude = p.Lon } }
                    }).ToArray(),
                    travelMode = "DRIVE"
                };

                using var req = new HttpRequestMessage(HttpMethod.Post, "https://routes.googleapis.com/directions/v2:computeRoutes");
                req.Headers.Add("X-Goog-Api-Key", apiKey);
                req.Headers.Add("X-Goog-FieldMask", "routes.polyline.encodedPolyline");
                req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                using var res = await _http.SendAsync(req, ct);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                    if (doc.RootElement.TryGetProperty("routes", out var rArr) && rArr.GetArrayLength() > 0)
                    {
                        var poly = rArr[0].GetProperty("polyline").GetProperty("encodedPolyline").GetString();
                        if (!string.IsNullOrWhiteSpace(poly)) return poly;
                    }
                }
            }
            catch { /* fall back to encoded straight-line polyline */ }
        }

        return EncodePolyline(points);
    }

    public static string EncodePolyline(IEnumerable<(double Lat, double Lon)> points)
    {
        var sb = new StringBuilder();
        int prevLat = 0, prevLon = 0;
        foreach (var (lat, lon) in points)
        {
            int latE5 = (int)Math.Round(lat * 1e5);
            int lonE5 = (int)Math.Round(lon * 1e5);
            EncodeValue(latE5 - prevLat, sb);
            EncodeValue(lonE5 - prevLon, sb);
            prevLat = latE5;
            prevLon = lonE5;
        }
        return sb.ToString();
    }

    private static void EncodeValue(int v, StringBuilder sb)
    {
        v = v < 0 ? ~(v << 1) : (v << 1);
        while (v >= 0x20)
        {
            sb.Append((char)((0x20 | (v & 0x1f)) + 63));
            v >>= 5;
        }
        sb.Append((char)(v + 63));
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return r * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private async Task<string> BuildExplanationAsync(int vehicleCount, int servedCount, int unservedCount, double minutesSaved, string source, CancellationToken ct)
    {
        var fallback = $"Optimized preview across {vehicleCount} vehicle route(s) serving {servedCount} stop(s)" +
                       (unservedCount > 0 ? $" ({unservedCount} unserved)" : "") +
                       $", saving ~{minutesSaved:F1} min vs nearest-vehicle baseline ({source}).";

        var apiKey = _config["Groq:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) return fallback;

        try
        {
            var model = _config["Groq:Model"] ?? "openai/gpt-oss-20b";
            var body = new
            {
                model,
                temperature = 0.1,
                messages = new[]
                {
                    new { role = "system", content = "Summarize this dispatch optimization preview in one concise sentence for a coordinator. Do not invent numbers." },
                    new { role = "user", content = fallback }
                }
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return fallback;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var txt = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            return string.IsNullOrWhiteSpace(txt) ? fallback : txt.Trim();
        }
        catch { return fallback; }
    }
}

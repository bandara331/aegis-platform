using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Computes real-time operational KPIs strictly from the database.
/// Never invents sample or fallback figures; returns zero/empty states when no records exist.
/// </summary>
public class KpiService : IKpiService
{
    private readonly AegisDbContext _context;

    public KpiService(AegisDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<KpiDto>> GetDashboardKpisAsync(CancellationToken cancellationToken = default)
    {
        var unresolved = await _context.AssistanceRequests
            .CountAsync(r => r.Status != RequestStatus.Fulfilled && r.Status != RequestStatus.Closed, cancellationToken);

        var today = DateTime.UtcNow.Date;
        var newToday = await _context.AssistanceRequests.CountAsync(r => r.CreatedAt >= today, cancellationToken);

        // Average time from request creation to first human decision (in minutes)
        var decidedPairs = await _context.Decisions
            .AsNoTracking()
            .Include(d => d.Recommendation)
            .ThenInclude(r => r!.Request)
            .Where(d => d.Recommendation != null && d.Recommendation.Request != null)
            .Select(d => new { RequestCreated = d.Recommendation!.Request!.CreatedAt, d.DecidedAt })
            .ToListAsync(cancellationToken);

        string avgResponseValue = "—";
        string avgResponseNote = "No decisions recorded yet";
        if (decidedPairs.Count > 0)
        {
            var avgMinutes = Math.Max(1, (int)Math.Round(decidedPairs.Average(p => (p.DecidedAt - p.RequestCreated).TotalMinutes)));
            avgResponseValue = $"{avgMinutes} min";
            avgResponseNote = $"across {decidedPairs.Count} decided cases";
        }

        var shelterCount = await _context.Shelters.CountAsync(cancellationToken);
        var totalCapacity = await _context.Shelters.SumAsync(s => (long)s.Capacity, cancellationToken);
        var totalOccupancy = await _context.Shelters.SumAsync(s => (long)s.Occupancy, cancellationToken);
        var occupancyPct = totalCapacity > 0 ? (int)Math.Round((double)totalOccupancy / totalCapacity * 100) : 0;
        var nearFull = await _context.Shelters
            .CountAsync(s => s.Capacity > 0 && s.Occupancy * 10 >= s.Capacity * 9, cancellationToken);

        var totalDecisions = await _context.Decisions.CountAsync(cancellationToken);
        var overrides = await _context.Decisions
            .CountAsync(d => d.Action == DecisionAction.Modify || d.Action == DecisionAction.Reject, cancellationToken);
        var overridePct = totalDecisions > 0 ? (int)Math.Round((double)overrides / totalDecisions * 100) : 0;

        return new List<KpiDto>
        {
            new("Unresolved cases", unresolved.ToString(), $"+{newToday} today", "#FF8A70"),
            new("Avg response time", avgResponseValue, avgResponseNote, "#2DD4A3"),
            new("Shelter occupancy", shelterCount > 0 ? $"{occupancyPct}%" : "0%", shelterCount > 0 ? $"{nearFull} shelters above 90%" : "No shelters registered", "#FFC65A"),
            new("AI override rate", totalDecisions > 0 ? $"{overridePct}%" : "0%", totalDecisions > 0 ? $"{overrides} of {totalDecisions} decisions" : "No decisions yet", "#9AA4B2")
        };
    }
}

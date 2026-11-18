using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class DispatchPlan : BaseEntity
{
    public string Status { get; set; } = "Preview"; // Preview | Approved | Discarded
    public string RoutesJson { get; set; } = "[]";
    public string UnservedJson { get; set; } = "[]";
    public double TotalDistanceKm { get; set; }
    public double TotalDurationMinutes { get; set; }
    public double BaselineDurationMinutes { get; set; }
    public double MinutesSaved { get; set; }
    public string RoutingSource { get; set; } = "Haversine (estimated)";
    public bool IsEstimated { get; set; } = true;
    public bool RequiresSecondApprover { get; set; }
    public string Explanation { get; set; } = string.Empty;
    public string CreatedById { get; set; } = string.Empty;
    public string? ApprovedById { get; set; }
    public string? SecondApproverId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
}

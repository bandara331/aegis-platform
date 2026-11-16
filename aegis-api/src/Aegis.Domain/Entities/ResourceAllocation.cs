using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class ResourceAllocation : BaseEntity
{
    public Guid ResourceId { get; set; }
    public Resource? Resource { get; set; }
    public Guid RequestId { get; set; }
    public AssistanceRequest? Request { get; set; }
    public int QuantityDispatched { get; set; }
    public string DispatchedById { get; set; } = string.Empty;
    public string Status { get; set; } = "Dispatched"; // Dispatched, Delivered, Returned
    public DateTime DispatchedAt { get; set; } = DateTime.UtcNow;
    public string EstimatedEta { get; set; } = "30 mins";
}

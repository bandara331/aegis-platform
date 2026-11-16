using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class ServiceHealth : BaseEntity
{
    public string ServiceName { get; set; } = string.Empty; // Database, AiEngine, Routing, Notification
    public string Status { get; set; } = "Healthy"; // Healthy, Degraded, Unhealthy
    public string? Details { get; set; }
    public DateTime LastCheckedAt { get; set; } = DateTime.UtcNow;
}

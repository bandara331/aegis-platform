using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class StockForecastSnapshot : BaseEntity
{
    public Guid ResourceId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Depot { get; set; } = string.Empty;
    public int QuantityAvailable { get; set; }
    public double EwmaHourlyRate { get; set; }
    public double? EstimatedHours { get; set; }
    public double? MinHours { get; set; }
    public double? MaxHours { get; set; }
    public double RainfallMultiplier { get; set; } = 1.0;
    public bool HasEnoughData { get; set; }
    public int DataPointsCount { get; set; }
    public bool AlertTriggered { get; set; }
    public string Explanation { get; set; } = string.Empty;
    public DateTime ComputedAtUtc { get; set; } = DateTime.UtcNow;
}

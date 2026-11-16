using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Resource : BaseEntity
{
    public string ItemName { get; set; } = string.Empty; // e.g. "Drinking Water", "Insulin"
    public string Category { get; set; } = string.Empty; // Medical, Water, Food
    public int QuantityTotal { get; set; }
    public int QuantityAvailable { get; set; }
    public string Unit { get; set; } = "units"; // units, liters, boxes
    public string Depot { get; set; } = string.Empty; // Depot A, Depot B
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public uint Version { get; set; } // mapped to postgres xmin for concurrency
}

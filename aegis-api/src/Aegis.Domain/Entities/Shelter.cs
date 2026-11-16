using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Shelter : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int Occupancy { get; set; }
    public string Facilities { get; set; } = string.Empty; // e.g. "Medical,Kitchen,Sanitation"
    public string AccessibilityTags { get; set; } = string.Empty; // e.g. "Wheelchair,GroundFloor"
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public uint Version { get; set; } // mapped to postgres xmin for concurrency
}

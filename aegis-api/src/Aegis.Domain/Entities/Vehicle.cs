using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Vehicle : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string VehicleType { get; set; } = "Van"; // Van | Truck | Boat | Ambulance | Motorcycle
    public int Capacity { get; set; } = 4;
    public double CurrentLatitude { get; set; }
    public double CurrentLongitude { get; set; }
    public Guid? AssignedVolunteerId { get; set; }
    public Volunteer? AssignedVolunteer { get; set; }
    public string? AssignedDriverName { get; set; }
    public string Availability { get; set; } = "Available"; // Available | Busy | Maintenance
    public string Skills { get; set; } = string.Empty; // comma-separated: medical,water-rescue
}

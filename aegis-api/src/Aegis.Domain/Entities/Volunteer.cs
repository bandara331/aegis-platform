using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Volunteer : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Skills { get; set; } = string.Empty; // e.g. "FirstAid,Driving,Sinhala,Tamil"
    public string Availability { get; set; } = "Immediate"; // Immediate, Weekends, Nights
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsActive { get; set; } = true;
}

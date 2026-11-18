using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class WeatherSnapshot : BaseEntity
{
    public string District { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public double? TemperatureC { get; set; }
    public double? PrecipitationMm { get; set; }
    public double? WindKph { get; set; }
    public string Severity { get; set; } = "Normal";
    public DateTime ObservedAt { get; set; } = DateTime.UtcNow;
}

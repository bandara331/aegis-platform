using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class OperationalArea : BaseEntity
{
    public Guid CrisisId { get; set; }
    public Crisis? Crisis { get; set; }
    public string Name { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public double CenterLatitude { get; set; }
    public double CenterLongitude { get; set; }
    public double RadiusKilometers { get; set; } = 15.0;
}

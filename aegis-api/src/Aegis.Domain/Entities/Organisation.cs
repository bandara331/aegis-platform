using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Organisation : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = "NGO"; // Government, NGO, Volunteer, International
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public bool IsVerified { get; set; } = true;
}

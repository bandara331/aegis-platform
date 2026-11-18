using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class OfficialAlert : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string Severity { get; set; } = "Warning"; // Info, Warning, Critical
    public string Language { get; set; } = "en"; // en, si, ta
    public string IssuedById { get; set; } = string.Empty;
    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAtUtc { get; set; }
    public bool IsExpired { get; set; }
}

using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Entities;

public class Crisis : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string Severity { get; set; } = "High";
    public CrisisStatus Status { get; set; } = CrisisStatus.Active;
    public DateTime DeclaredAt { get; set; } = DateTime.UtcNow;
}

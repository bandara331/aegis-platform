using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Campaign : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal TargetAmount { get; set; }
    public decimal CurrentAmount { get; set; }
    public Guid CrisisId { get; set; }
    public Crisis? Crisis { get; set; }
    public bool IsActive { get; set; } = true;
}

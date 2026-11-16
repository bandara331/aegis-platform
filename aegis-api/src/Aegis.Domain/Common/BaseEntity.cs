namespace Aegis.Domain.Common;

/// <summary>
/// Abstract base entity providing identity, auditing timestamps, and soft deletion.
/// Pattern: Layer Supertype.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
}

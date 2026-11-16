using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

/// <summary>
/// Tamper-evident, cryptographically chained audit log entry.
/// Hash = SHA256(PreviousHash + EntityName + EntityId + Action + ActorId + Timestamp + PayloadHash).
/// </summary>
public class AuditLogEntry : BaseEntity
{
    public long SequenceNumber { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // Create, Update, Decision, Allocation
    public string ActorId { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;
    public string DetailsJson { get; set; } = "{}";
    public string PreviousHash { get; set; } = string.Empty;
    public string CurrentHash { get; set; } = string.Empty;
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

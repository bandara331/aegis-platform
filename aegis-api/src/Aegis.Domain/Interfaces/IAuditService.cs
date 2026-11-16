using Aegis.Domain.Entities;

namespace Aegis.Domain.Interfaces;

/// <summary>
/// Service managing the append-only, tamper-evident cryptographic audit chain.
/// </summary>
public interface IAuditService
{
    Task<AuditLogEntry> AppendAsync(string entityName, string entityId, string action, string actorId, string actorRole, object details, CancellationToken cancellationToken = default);
    Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default);
}

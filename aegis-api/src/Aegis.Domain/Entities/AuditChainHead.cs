using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

/// <summary>
/// Single row tracking the tip of the cryptographic audit hash chain.
/// Protected by SELECT ... FOR UPDATE or advisory locks during append.
/// </summary>
public class AuditChainHead : BaseEntity
{
    public long LastSequenceNumber { get; set; }
    public string LastHash { get; set; } = "GENESIS_AEGIS_CHAIN_INITIAL_STATE";
    public DateTime LastUpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

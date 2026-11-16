using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Aegis.Domain.Entities;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly AegisDbContext _context;
    private readonly ILogger<AuditService> _logger;

    public AuditService(AegisDbContext context, ILogger<AuditService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<AuditLogEntry> AppendAsync(
        string entityName,
        string entityId,
        string action,
        string actorId,
        string actorRole,
        object details,
        CancellationToken cancellationToken = default)
    {
        // PostgreSQL timestamptz stores microsecond precision. Truncate BEFORE hashing so the value we hash
        // is exactly the value that is read back later; otherwise VerifyChain would report false tampering.
        var now = DateTime.UtcNow;
        var timestamp = new DateTime(now.Ticks - (now.Ticks % 10), DateTimeKind.Utc);
        var detailsJson = details is string str ? str : JsonSerializer.Serialize(details);

        // Serialise writers: run inside a transaction and take a transaction-scoped advisory lock,
        // so two concurrent appends can never read the same chain head.
        var ownsTransaction = false;
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = null;
        if (_context.Database.IsRelational() && _context.Database.CurrentTransaction == null)
        {
            tx = await _context.Database.BeginTransactionAsync(cancellationToken);
            ownsTransaction = true;
        }

        try
        {
            if (_context.Database.IsNpgsql())
            {
                await _context.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(727274)", cancellationToken);
            }

            var head = await _context.AuditChainHeads.FirstOrDefaultAsync(cancellationToken);

            if (head == null)
            {
                head = new AuditChainHead
                {
                    LastSequenceNumber = 0,
                    LastHash = "GENESIS_AEGIS_CHAIN_INITIAL_STATE",
                    LastUpdatedAtUtc = timestamp
                };
                _context.AuditChainHeads.Add(head);
            }

            var sequenceNumber = head.LastSequenceNumber + 1;
            var previousHash = head.LastHash;
            var currentHash = ComputeHash(previousHash, sequenceNumber, entityName, entityId, action, actorId, timestamp, detailsJson);

            var entry = new AuditLogEntry
            {
                SequenceNumber = sequenceNumber,
                EntityName = entityName,
                EntityId = entityId,
                Action = action,
                ActorId = actorId,
                ActorRole = actorRole,
                DetailsJson = detailsJson,
                PreviousHash = previousHash,
                CurrentHash = currentHash,
                TimestampUtc = timestamp
            };

            head.LastSequenceNumber = sequenceNumber;
            head.LastHash = currentHash;
            head.LastUpdatedAtUtc = timestamp;

            _context.AuditLogEntries.Add(entry);
            await _context.SaveChangesAsync(cancellationToken);

            if (ownsTransaction && tx != null) await tx.CommitAsync(cancellationToken);

            _logger.LogInformation("Audit entry {SequenceNumber} appended: {Action} on {EntityName}:{EntityId}",
                sequenceNumber, action, entityName, entityId);

            return entry;
        }
        catch
        {
            if (ownsTransaction && tx != null) await tx.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (tx != null) await tx.DisposeAsync();
        }
    }

    public async Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default)
    {
        var entries = await _context.AuditLogEntries
            .OrderBy(e => e.SequenceNumber)
            .ToListAsync(cancellationToken);

        if (entries.Count == 0)
        {
            return (true, null, null);
        }

        var expectedPrevHash = "GENESIS_AEGIS_CHAIN_INITIAL_STATE";

        foreach (var entry in entries)
        {
            if (entry.PreviousHash != expectedPrevHash)
            {
                return (false, entry.SequenceNumber,
                    $"Previous hash mismatch at sequence {entry.SequenceNumber}. Expected {expectedPrevHash}, found {entry.PreviousHash}.");
            }

            var calculatedHash = ComputeHash(
                entry.PreviousHash,
                entry.SequenceNumber,
                entry.EntityName,
                entry.EntityId,
                entry.Action,
                entry.ActorId,
                entry.TimestampUtc,
                entry.DetailsJson);

            if (entry.CurrentHash != calculatedHash)
            {
                return (false, entry.SequenceNumber,
                    $"Current hash corrupted at sequence {entry.SequenceNumber}. Calculated {calculatedHash}, stored {entry.CurrentHash}.");
            }

            expectedPrevHash = entry.CurrentHash;
        }

        return (true, null, null);
    }

    public static string ComputeHash(
        string previousHash,
        long sequenceNumber,
        string entityName,
        string entityId,
        string action,
        string actorId,
        DateTime timestampUtc,
        string detailsJson)
    {
        var raw = $"{previousHash}|{sequenceNumber}|{entityName}|{entityId}|{action}|{actorId}|{timestampUtc:O}|{detailsJson}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexStringLower(bytes);
    }
}

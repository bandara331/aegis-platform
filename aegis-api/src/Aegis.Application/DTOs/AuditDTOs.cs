namespace Aegis.Application.DTOs;

public record AuditEntryDto(
    long SequenceNumber,
    string EntityName,
    string EntityId,
    string Action,
    string ActorId,
    string ActorRole,
    string DetailsJson,
    string PreviousHash,
    string CurrentHash,
    DateTime TimestampUtc
);

public record AuditVerifyDto(
    bool IsValid,
    long? BrokenSequenceNumber,
    string? ErrorMessage,
    int TotalEntriesVerified
);

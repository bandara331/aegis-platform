namespace Aegis.Application.DTOs;

public record CreateRequestDto(
    Guid CrisisId,
    string Category,
    string Description,
    string Language,
    string Area,
    double Latitude,
    double Longitude,
    int SelfReportedUrgency,
    int PeopleCount,
    bool ConsentGiven
);

public record UpdateRequestDto(
    string? Status,
    string? Priority,
    string? Notes
);

public record RequestResponseDto(
    Guid Id,
    string TrackingNumber,
    string? CitizenId,
    Guid CrisisId,
    string Category,
    string Description,
    string Language,
    string Area,
    double Latitude,
    double Longitude,
    string Status,
    string Priority,
    int UrgencyScore,
    Guid? DuplicateOfId,
    int PeopleCount,
    DateTime CreatedAt
);

/// <summary>
/// Matches the Next.js frontend contract exactly:
/// GET /api/v1/cases?sort=ai_priority returns [{id, need, area, wait, priority: "critical"|"high"|"medium", score, status, selected?}]
/// </summary>
public record CaseItemDto(
    string Id,
    string Need,
    string Area,
    string Wait,
    string Priority, // "critical" | "high" | "medium"
    int Score,
    string Status,
    bool? Selected = false
);

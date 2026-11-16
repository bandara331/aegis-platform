namespace Aegis.Application.DTOs;

public record DecisionRequestDto(
    string Action, // Approve, Modify, Reject, Defer
    string Justification, // Required for Modify and Reject
    string? SecondApproverId, // Required for critical actions
    string? OverridePriority,
    string? SelectedResourceOrDepot
);

public record DecisionResponseDto(
    Guid DecisionId,
    Guid RecommendationId,
    string Action,
    string DecidedById,
    string? SecondApproverId,
    DateTime DecidedAt,
    string RequestStatus,
    string Message
);

public record AiRecommendationDto(
    Guid Id,
    Guid RequestId,
    string RequestTrackingNumber,
    string ModelName,
    string ModelVersion,
    string Priority,
    double Confidence,
    string RationaleJson,
    string FeatureScoresJson,
    string Status,
    DateTime CreatedAt
);

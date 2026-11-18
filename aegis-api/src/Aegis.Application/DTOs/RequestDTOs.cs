namespace Aegis.Application.DTOs;

public record CreateRequestDto(
    Guid? CrisisId,
    string Category,
    string Description,
    string Language,
    string Area,
    double Latitude,
    double Longitude,
    int SelfReportedUrgency,
    int PeopleCount,
    bool ConsentGiven,
    string? VulnerableFlags = null,
    string? ContactMobile = null,
    string? ContactEmail = null,
    bool ConfirmDuplicate = false
);

public record UpdateRequestDto(
    string? Status,
    string? Priority,
    string? Notes
);

public record UpdateRequestStatusDto(
    string Status,
    string? ReasonOrNotes = null
);

public record CancelRequestDto(
    string? Reason = null
);

public record SubmitFeedbackDto(
    int Rating,
    string? Comment = null
);

public record CitizenContactProfileDto(
    string UserId,
    string FullName,
    string Email,
    string Mobile,
    string Language
);

public record RequestTimelineStepDto(
    string Stage,
    string FromStatus,
    string ToStatus,
    string Notes,
    DateTime TimestampUtc,
    bool Completed,
    bool Current
);

public record RequestEvidenceItemDto(
    Guid Id,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string Sha256Hash,
    DateTime CreatedAt
);

public record DuplicateWarningDto(
    Guid ExistingRequestId,
    string ExistingTrackingNumber,
    string Category,
    string Area,
    string Status,
    double DistanceMeters,
    DateTime CreatedAt,
    string Message
);

public record RequestResponseDto(
    Guid Id,
    string TrackingNumber,
    string? CitizenId,
    Guid? CrisisId,
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
    DateTime CreatedAt,
    string? VulnerableFlags = null,
    string? ContactMobile = null,
    string? ContactEmail = null,
    string? RejectionReason = null,
    string? CancellationReason = null,
    int? FeedbackRating = null,
    string? FeedbackComment = null,
    DateTime? FeedbackSubmittedAt = null,
    bool CanCancel = false,
    bool CanSubmitFeedback = false,
    IReadOnlyList<RequestTimelineStepDto>? Timeline = null,
    IReadOnlyList<RequestEvidenceItemDto>? Evidence = null,
    string? AiPriority = null,
    double? AiConfidence = null,
    string? MaskedNic = null,
    string? EnglishTranslation = null,
    Guid? RecommendationId = null,
    string? DetectedLanguage = null,
    string? NormalizedText = null,
    string? ExtractedJson = null,
    double? LanguageConfidence = null,
    bool AiTranslated = false
);

public record PagedRequestsDto(
    IReadOnlyList<RequestResponseDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public record RequestChatMessageDto(
    Guid Id,
    Guid RequestId,
    string SenderRole,
    string SenderName,
    string MessageText,
    DateTime CreatedAt,
    bool IsSystem
);

public record SendChatMessageDto(
    string MessageText,
    bool UsedAiDraft = false
);

public record KeepSeparateDuplicateDto(
    Guid CandidateRequestId,
    string Notes
);

/// <summary>
/// Matches the Next.js frontend contract:
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
    bool? Selected = false,
    bool? DistressFlagged = false,
    string? DistressLevel = null,
    DateTime? DistressAcknowledgedAt = null
);

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
    DateTime CreatedAt,
    bool IsShadow = false,
    bool BelowThreshold = false,
    string PromptVersion = "aegis-nlp-v3.0",
    string CounterfactualNote = ""
);

public record AiGovernanceConfigDto(
    string Mode,
    double ConfidenceThreshold,
    double FairnessDisparityThreshold,
    string UpdatedById,
    string UpdatedReason,
    DateTime UpdatedAt
);

public record UpdateAiGovernanceDto(
    string Mode,
    double ConfidenceThreshold,
    double FairnessDisparityThreshold,
    string Reason
);

public record AiAuditEventDto(
    long SequenceNumber,
    string ActorId,
    string DetailsJson,
    DateTime CreatedAt
);

public record AiGovernanceViewDto(
    AiGovernanceConfigDto Config,
    IReadOnlyList<AiAuditEventDto> History
);

public record AiStatusDto(
    string Mode,
    double ConfidenceThreshold,
    double FairnessDisparityThreshold,
    bool IsPaused,
    bool IsShadow
);

public record AiBreakdownBucketDto(
    string Key,
    int Total,
    int Agreed,
    int Modified,
    int Rejected,
    int Deferred,
    double AgreementRate
);

public record AiCalibrationBucketDto(
    string Bucket,
    int Count,
    double AvgConfidence,
    double AgreementRate
);

public record AiFairnessRowDto(
    string Group,
    int Count,
    double CriticalRate,
    double HighRate,
    double AgreementRate,
    double DisparityFromMean,
    bool Flagged
);

public record AiAnalyticsDto(
    DateTime From,
    DateTime To,
    int TotalRecommendations,
    int DecidedCount,
    int AgreedCount,
    int ModifiedCount,
    int RejectedCount,
    int DeferredCount,
    double AgreementRate,
    double FairnessDisparityThreshold,
    int FlaggedFairnessGroups,
    IReadOnlyList<AiBreakdownBucketDto> ByDay,
    IReadOnlyList<AiBreakdownBucketDto> ByLanguage,
    IReadOnlyList<AiBreakdownBucketDto> ByDistrict,
    IReadOnlyList<AiBreakdownBucketDto> ByCategory,
    IReadOnlyList<AiCalibrationBucketDto> CalibrationBuckets,
    IReadOnlyList<AiFairnessRowDto> FairnessByLanguage,
    IReadOnlyList<AiFairnessRowDto> FairnessByDistrict
);

public record ChatSummaryDto(
    Guid RequestId,
    IReadOnlyList<string> Bullets,
    string PromptVersion,
    bool UsedFallback
);

public record SuggestedReplyDto(
    Guid RequestId,
    string TargetLanguage,
    string DraftText,
    string PromptVersion,
    bool UsedFallback
);

public record HandoverItemDto(
    Guid RequestId,
    string TrackingNumber,
    string Priority,
    string Status,
    string Area,
    bool DistressFlagged,
    string ChangeSummary,
    DateTime LastActivityUtc
);

public record HandoverNoteDto(
    string StaffUserId,
    DateTime SinceUtc,
    DateTime GeneratedAtUtc,
    string SummaryText,
    IReadOnlyList<HandoverItemDto> Items
);

public record NlSearchRequestDto(
    string Query,
    NlSearchFilterDto? OverrideFilters = null
);

public record NlSearchFilterDto(
    string? Status = null,
    string? Priority = null,
    string? District = null,
    string? Category = null,
    string? Assigned = null,
    string? DateRange = null,
    string? Language = null,
    bool? Unassigned = null
);

public record NlSearchResponseDto(
    NlSearchFilterDto Filters,
    IReadOnlyList<RequestResponseDto> Items,
    int TotalCount,
    bool UsedFallback
);

public record SituationReportDraftDto(
    Guid Id,
    string Title,
    string ContentMarkdown,
    string Status,
    bool IsAiAssisted,
    string CreatedById,
    string? PublishedById,
    DateTime? PublishedAt,
    DateTime UpdatedAt
);

public record UpdateSituationReportDraftDto(
    string Title,
    string ContentMarkdown
);

public record DistressSignalDto(
    Guid RequestId,
    string TrackingNumber,
    string DistressLevel,
    string Reason,
    double Confidence,
    string NewPriority,
    DateTime DetectedAtUtc
);

public record StockForecastDto(
    Guid ResourceId,
    string ItemName,
    string Category,
    string Depot,
    int QuantityAvailable,
    string Unit,
    bool HasEnoughData,
    int DataPointsCount,
    double EwmaHourlyRate,
    double RainfallMultiplier,
    double? EstimatedHours,
    double? MinHours,
    double? MaxHours,
    bool AlertTriggered,
    string DisplayText,
    string Explanation,
    DateTime ComputedAtUtc
);

public record RiskFactorDto(
    string Name,
    string Value,
    string Source,
    double WeightContribution
);

public record DistrictRiskDto(
    string District,
    double Latitude,
    double Longitude,
    string RiskLevel,
    double RiskScore,
    string AdvisoryNotice,
    DateTime LastUpdatedUtc,
    bool IsStale,
    IReadOnlyList<RiskFactorDto> Factors
);

public record DistrictRiskResponseDto(
    string AdvisoryNotice,
    DateTime LastUpdatedUtc,
    bool AnyStale,
    IReadOnlyList<DistrictRiskDto> Districts
);

public record VehicleDto(
    Guid Id,
    string Name,
    string VehicleType,
    int Capacity,
    double CurrentLatitude,
    double CurrentLongitude,
    Guid? AssignedVolunteerId,
    string? AssignedDriverName,
    string Availability,
    string Skills
);

public record CreateVehicleDto(
    string Name,
    string VehicleType,
    int Capacity,
    double CurrentLatitude,
    double CurrentLongitude,
    Guid? AssignedVolunteerId = null,
    string? AssignedDriverName = null,
    string Availability = "Available",
    string Skills = ""
);

public record DispatchPlanRequestDto(
    IReadOnlyList<Guid>? RequestIds = null,
    IReadOnlyList<Guid>? VehicleIds = null
);

public record DispatchStopDto(
    Guid RequestId,
    string TrackingNumber,
    string Area,
    string Category,
    string Priority,
    int PeopleCount,
    double Latitude,
    double Longitude,
    int Sequence,
    double EtaMinutes,
    double DistanceFromPrevKm
);

public record DispatchVehicleRouteDto(
    Guid VehicleId,
    string VehicleName,
    string VehicleType,
    string DriverName,
    int TotalStops,
    int TotalLoad,
    int Capacity,
    double TotalDistanceKm,
    double TotalDurationMinutes,
    string EncodedPolyline,
    IReadOnlyList<DispatchStopDto> Stops
);

public record UnservedStopDto(
    Guid RequestId,
    string TrackingNumber,
    string Priority,
    int PeopleCount,
    string Reason
);

public record DispatchPlanDto(
    Guid Id,
    string Status,
    string RoutingSource,
    bool IsEstimated,
    double TotalDistanceKm,
    double TotalDurationMinutes,
    double BaselineDurationMinutes,
    double MinutesSaved,
    bool RequiresSecondApprover,
    string Explanation,
    IReadOnlyList<DispatchVehicleRouteDto> Routes,
    IReadOnlyList<UnservedStopDto> Unserved,
    DateTime CreatedAtUtc
);

public record ApproveDispatchPlanDto(
    string? SecondApproverId = null
);

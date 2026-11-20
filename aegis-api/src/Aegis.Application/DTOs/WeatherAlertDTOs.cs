using Aegis.Domain.Common;

namespace Aegis.Application.DTOs;

public record WeatherAlertRuleDto(
    Guid Id,
    string Name,
    string Mode,
    string TriggerLevels,
    double Rainfall24hHighMm,
    double Rainfall24hSevereMm,
    double Rainfall72hHighMm,
    double Rainfall72hSevereMm,
    double RiverDischargeHighM3s,
    double RiverDischargeSevereM3s,
    int CooldownHours,
    double HysteresisMargin,
    bool SendRiskReducedNotice,
    int DailyAlertCapPerDistrict,
    int MaxDataAgeMinutes,
    DateTime? LastEvaluatedAtUtc,
    string? LastEvaluationStatus,
    DateTime UpdatedAt
);

public record UpdateWeatherAlertRuleDto(
    string? Mode,
    string? TriggerLevels,
    double? Rainfall24hHighMm,
    double? Rainfall24hSevereMm,
    double? Rainfall72hHighMm,
    double? Rainfall72hSevereMm,
    double? RiverDischargeHighM3s,
    double? RiverDischargeSevereM3s,
    int? CooldownHours,
    double? HysteresisMargin,
    bool? SendRiskReducedNotice,
    int? DailyAlertCapPerDistrict,
    int? MaxDataAgeMinutes,
    string Reason
);

public record AutomatedAlertDto(
    Guid Id,
    string District,
    string PreviousLevel,
    string TriggeredLevel,
    string AlertKind,
    string Status,
    string DedupeKey,
    string TriggeringValuesJson,
    string DataSource,
    DateTime DataTimestampUtc,
    string ModelUsed,
    string PromptVersion,
    string MessageEn,
    string MessageSi,
    string MessageTa,
    int RecipientCount,
    string? ApprovedById,
    DateTime? ApprovedAtUtc,
    DateTime? SentAtUtc,
    string? RetractedById,
    DateTime? RetractedAtUtc,
    string? RetractionReason,
    bool IsFalseAlarm,
    string? FalseAlarmNotes,
    bool IsActive,
    DateTime CreatedAt
);

public record WeatherAlertAnalyticsDto(
    int TotalAlerts,
    int SentCount,
    int DraftCount,
    int RetractedCount,
    int FalseAlarmCount,
    double FalseAlarmRate
);

public record WeatherAlertAdminViewDto(
    WeatherAlertRuleDto Rule,
    IReadOnlyList<AutomatedAlertDto> ApprovalQueue,
    IReadOnlyList<AutomatedAlertDto> History,
    WeatherAlertAnalyticsDto Analytics
);

public record DryRunPreviewDto(
    string District,
    string EvaluatedLevel,
    int EligibleRecipientCount,
    string FactsJson,
    string ModelUsed,
    string PromptVersion,
    string MessageEn,
    string MessageSi,
    string MessageTa
);

public record AlertActionReasonDto(string Reason);
public record MarkFalseAlarmDto(string? Notes);

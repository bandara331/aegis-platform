using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class WeatherAlertRule : BaseEntity
{
    public string Name { get; set; } = "Default Sri Lanka Weather Advisory Rule";
    public string Mode { get; set; } = "DraftForApproval"; // AutoSend | DraftForApproval | Off
    public string TriggerLevels { get; set; } = "High,Severe";
    public double Rainfall24hHighMm { get; set; } = 80.0;
    public double Rainfall24hSevereMm { get; set; } = 150.0;
    public double Rainfall72hHighMm { get; set; } = 180.0;
    public double Rainfall72hSevereMm { get; set; } = 300.0;
    public double RiverDischargeHighM3s { get; set; } = 400.0;
    public double RiverDischargeSevereM3s { get; set; } = 800.0;
    public int CooldownHours { get; set; } = 12;
    public double HysteresisMargin { get; set; } = 0.10;
    public bool SendRiskReducedNotice { get; set; } = true;
    public int DailyAlertCapPerDistrict { get; set; } = 2;
    public int MaxDataAgeMinutes { get; set; } = 120;
    public DateTime? LastEvaluatedAtUtc { get; set; }
    public string? LastEvaluationStatus { get; set; }
    public string? UpdatedById { get; set; }
    public string? LastChangeReason { get; set; }
}

public class AutomatedAlert : BaseEntity
{
    public string District { get; set; } = string.Empty;
    public string PreviousLevel { get; set; } = "Low";
    public string TriggeredLevel { get; set; } = "High"; // High | Severe | Reduced
    public string AlertKind { get; set; } = "ThresholdCrossed"; // ThresholdCrossed | RiskReduced
    public string Status { get; set; } = "Draft"; // Draft | Sent | Retracted | Suppressed
    public string DedupeKey { get; set; } = string.Empty;
    public Guid? RuleId { get; set; }
    public string RuleSnapshotJson { get; set; } = "{}";
    public string TriggeringValuesJson { get; set; } = "{}";
    public string DataSource { get; set; } = "Open-Meteo";
    public DateTime DataTimestampUtc { get; set; } = DateTime.UtcNow;
    public string ModelUsed { get; set; } = "template";
    public string PromptVersion { get; set; } = "template";
    public string MessageEn { get; set; } = string.Empty;
    public string MessageSi { get; set; } = string.Empty;
    public string MessageTa { get; set; } = string.Empty;
    public int RecipientCount { get; set; }
    public string? ApprovedById { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public string? RetractedById { get; set; }
    public DateTime? RetractedAtUtc { get; set; }
    public string? RetractionReason { get; set; }
    public bool IsFalseAlarm { get; set; }
    public string? FalseAlarmMarkedById { get; set; }
    public DateTime? FalseAlarmMarkedAtUtc { get; set; }
    public string? FalseAlarmNotes { get; set; }
    public bool IsActive { get; set; } = true;
}

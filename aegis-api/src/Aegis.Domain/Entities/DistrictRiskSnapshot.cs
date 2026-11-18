using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class DistrictRiskSnapshot : BaseEntity
{
    public string District { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string RiskLevel { get; set; } = "Low"; // Low | Medium | High | Severe
    public double RiskScore { get; set; }
    public double? Rainfall24hMm { get; set; }
    public double? Rainfall72hMm { get; set; }
    public double? RiverDischargeM3s { get; set; }
    public string OfficialAlertLevel { get; set; } = "None";
    public int OpenRequestsCount { get; set; }
    public string FactorsJson { get; set; } = "[]";
    public DateTime DataUpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ComputedAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsStale { get; set; }
    public string AdvisoryNotice { get; set; } = "advisory, not official";
}

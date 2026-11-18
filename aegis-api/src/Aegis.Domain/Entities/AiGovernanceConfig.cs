using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class AiGovernanceConfig : BaseEntity
{
    /// <summary>Active | Shadow | Off</summary>
    public string Mode { get; set; } = "Active";
    public double ConfidenceThreshold { get; set; } = 0.65;
    public double FairnessDisparityThreshold { get; set; } = 0.20;
    public string UpdatedById { get; set; } = "system";
    public string UpdatedReason { get; set; } = "Initial default configuration";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

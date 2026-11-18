using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Entities;

public class AiRecommendation : BaseEntity
{
    public Guid RequestId { get; set; }
    public AssistanceRequest? Request { get; set; }
    public string ModelName { get; set; } = "RuleBasedHeuristicEngine";
    public string ModelVersion { get; set; } = "1.0.0";
    public RequestPriority Priority { get; set; } = RequestPriority.Medium;
    public double Confidence { get; set; } // e.g. 0.87
    public string RationaleJson { get; set; } = "{}"; // jsonb
    public string FeatureScoresJson { get; set; } = "{}"; // jsonb
    public RecommendationStatus Status { get; set; } = RecommendationStatus.Pending;
    public bool IsShadow { get; set; }
    public bool BelowThreshold { get; set; }
    public string PromptVersion { get; set; } = "aegis-nlp-v3.0";
    public string CounterfactualNote { get; set; } = string.Empty;

    public ICollection<Decision> Decisions { get; set; } = new List<Decision>();
}

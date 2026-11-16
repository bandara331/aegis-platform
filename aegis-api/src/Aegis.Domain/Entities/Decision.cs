using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Entities;

public class Decision : BaseEntity
{
    public Guid RecommendationId { get; set; }
    public AiRecommendation? Recommendation { get; set; }
    public DecisionAction Action { get; set; } = DecisionAction.Approve;
    public string DecidedById { get; set; } = string.Empty;
    public string Justification { get; set; } = string.Empty;
    public string? SecondApproverId { get; set; }
    public DateTime DecidedAt { get; set; } = DateTime.UtcNow;
    public bool IsCriticalAction { get; set; }
}

using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Events;

public class DecisionMadeEvent : IDomainEvent
{
    public Guid DecisionId { get; }
    public Guid RecommendationId { get; }
    public DecisionAction Action { get; }
    public string DecidedById { get; }
    public DateTime OccurredOn { get; } = DateTime.UtcNow;

    public DecisionMadeEvent(Guid decisionId, Guid recommendationId, DecisionAction action, string decidedById)
    {
        DecisionId = decisionId;
        RecommendationId = recommendationId;
        Action = action;
        DecidedById = decidedById;
    }
}

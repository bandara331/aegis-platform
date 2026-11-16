using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Events;

public class RecommendationCreatedEvent : IDomainEvent
{
    public Guid RecommendationId { get; }
    public Guid RequestId { get; }
    public RequestPriority Priority { get; }
    public double Confidence { get; }
    public DateTime OccurredOn { get; } = DateTime.UtcNow;

    public RecommendationCreatedEvent(Guid recommendationId, Guid requestId, RequestPriority priority, double confidence)
    {
        RecommendationId = recommendationId;
        RequestId = requestId;
        Priority = priority;
        Confidence = confidence;
    }
}

using Aegis.Domain.Common;

namespace Aegis.Domain.Events;

public class RequestCreatedEvent : IDomainEvent
{
    public Guid RequestId { get; }
    public string TrackingNumber { get; }
    public DateTime OccurredOn { get; } = DateTime.UtcNow;

    public RequestCreatedEvent(Guid requestId, string trackingNumber)
    {
        RequestId = requestId;
        TrackingNumber = trackingNumber;
    }
}

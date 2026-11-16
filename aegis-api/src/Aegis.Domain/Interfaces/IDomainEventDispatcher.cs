using Aegis.Domain.Common;

namespace Aegis.Domain.Interfaces;

/// <summary>
/// Domain event handler interface for the Observer pattern.
/// Pattern: Observer.
/// </summary>
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, CancellationToken cancellationToken = default);
}

/// <summary>
/// Small in-house dispatcher for domain events (replacing MediatR as requested).
/// Pattern: Observer / Mediator (lightweight).
/// </summary>
public interface IDomainEventDispatcher
{
    Task DispatchAsync(IDomainEvent domainEvent, CancellationToken cancellationToken = default);
}

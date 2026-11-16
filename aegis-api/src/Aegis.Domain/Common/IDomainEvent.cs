namespace Aegis.Domain.Common;

/// <summary>
/// Represents a domain event notification for the Observer pattern.
/// Pattern: Observer (Domain Event).
/// </summary>
public interface IDomainEvent
{
    DateTime OccurredOn { get; }
}

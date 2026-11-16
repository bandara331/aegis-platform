using Aegis.Domain.Common;
using Aegis.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public class DomainEventDispatcher : IDomainEventDispatcher
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DomainEventDispatcher> _logger;

    public DomainEventDispatcher(IServiceProvider serviceProvider, ILogger<DomainEventDispatcher> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task DispatchAsync(IDomainEvent domainEvent, CancellationToken cancellationToken = default)
    {
        var eventType = domainEvent.GetType();
        var handlerType = typeof(IDomainEventHandler<>).MakeGenericType(eventType);
        var handlers = _serviceProvider.GetServices(handlerType);

        foreach (var handler in handlers)
        {
            if (handler == null) continue;

            try
            {
                var method = handlerType.GetMethod(nameof(IDomainEventHandler<IDomainEvent>.HandleAsync));
                if (method != null)
                {
                    var task = (Task?)method.Invoke(handler, new object[] { domainEvent, cancellationToken });
                    if (task != null)
                    {
                        await task;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing domain event handler {HandlerType} for event {EventType}",
                    handler.GetType().Name, eventType.Name);
            }
        }
    }
}

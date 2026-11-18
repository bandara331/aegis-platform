using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using Aegis.Application.Interfaces;

namespace Aegis.Infrastructure.Services;

public sealed class InMemoryRealtimeSignalPublisher : IRealtimeSignalPublisher
{
    private readonly ConcurrentDictionary<Guid, Channel<string>> _subscribers = new();

    public (Guid SubscriptionId, ChannelReader<string> Reader) Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(64)
        {
            FullMode = BoundedChannelFullMode.DropOldest
        });
        _subscribers[id] = channel;
        return (id, channel.Reader);
    }

    public void Unsubscribe(Guid subscriptionId)
    {
        if (_subscribers.TryRemove(subscriptionId, out var ch))
        {
            ch.Writer.TryComplete();
        }
    }

    public Task PublishAsync(string eventType, object payload, CancellationToken cancellationToken = default)
    {
        var envelope = JsonSerializer.Serialize(new
        {
            eventType,
            timestampUtc = DateTime.UtcNow,
            payload
        });

        foreach (var kv in _subscribers)
        {
            kv.Value.Writer.TryWrite(envelope);
        }

        return Task.CompletedTask;
    }
}

using System.Collections.Concurrent;

namespace Aegis.Infrastructure.Services;

public sealed class AiRateLimiter
{
    private readonly ConcurrentDictionary<string, Queue<DateTime>> _windows = new(StringComparer.Ordinal);
    private readonly int _maxRequestsPerMinute;

    public AiRateLimiter(int maxRequestsPerMinute = 20)
    {
        _maxRequestsPerMinute = maxRequestsPerMinute;
    }

    public bool TryAcquire(string userKey)
    {
        var key = string.IsNullOrWhiteSpace(userKey) ? "anonymous" : userKey;
        var now = DateTime.UtcNow;
        var cutoff = now.AddMinutes(-1);
        var queue = _windows.GetOrAdd(key, _ => new Queue<DateTime>());

        lock (queue)
        {
            while (queue.Count > 0 && queue.Peek() < cutoff)
            {
                queue.Dequeue();
            }

            if (queue.Count >= _maxRequestsPerMinute)
            {
                return false;
            }

            queue.Enqueue(now);
            return true;
        }
    }
}

using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class IdempotencyRecord : BaseEntity
{
    public string Key { get; set; } = string.Empty; // Idempotency-Key header value
    public string RequestPath { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string ResponseBody { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddHours(24);
}

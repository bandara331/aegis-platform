using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Entities;

public class NotificationOutbox : BaseEntity
{
    public string IdempotencyKey { get; set; } = string.Empty; // UNIQUE
    public NotificationChannel Channel { get; set; } = NotificationChannel.Email;
    public string Recipient { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    public int Attempts { get; set; }
    public DateTime? NextAttemptAt { get; set; } = DateTime.UtcNow;
    public string? LastError { get; set; }
}

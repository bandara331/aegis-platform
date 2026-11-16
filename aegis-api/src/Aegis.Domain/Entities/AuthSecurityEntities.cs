using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

/// <summary>
/// Stores hashed 6-digit email OTP challenges with 10-minute expiry, max 5 attempts, and 60s resend cooldown.
/// Plaintext OTP codes are never persisted or logged.
/// </summary>
public class EmailOtpChallenge : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string Purpose { get; set; } = "VerifyEmail"; // VerifyEmail | PasswordReset | StaffLogin2FA
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public int Attempts { get; set; }
    public int MaxAttempts { get; set; } = 5;
    public DateTime ResendAvailableAtUtc { get; set; }
    public DateTime? ConsumedAtUtc { get; set; }
}

/// <summary>
/// Stores one-time staff invitations with a hashed 24-hour set-password token.
/// </summary>
public class StaffInvitation : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string PreferredLanguage { get; set; } = "en";
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? AcceptedAtUtc { get; set; }
    public string InvitedById { get; set; } = string.Empty;
}

using Microsoft.AspNetCore.Identity;

namespace Aegis.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public Guid? OrganisationId { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public string? NicCiphertext { get; set; } // AES-256-GCM encrypted NIC (nonce + tag + ciphertext)
    public string? NicHmac { get; set; }       // HMAC-SHA256 hash of normalized NIC (UNIQUE index)
    public string? MaskedNic { get; set; }     // Masked display string, e.g. *******23V
    public bool PersonalDataConsent { get; set; }
    public DateTime? ConsentGivenAtUtc { get; set; }
    public bool AlertOptIn { get; set; } = false;
    public string? District { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

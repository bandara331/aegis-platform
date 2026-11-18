using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class Donation : BaseEntity
{
    public Guid CampaignId { get; set; }
    public Campaign? Campaign { get; set; }
    public string DonorName { get; set; } = string.Empty;
    public string DonorEmail { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public bool Flagged { get; set; }
    public string? FlagReason { get; set; }
    public string? ReviewStatus { get; set; } // Pending, Approved, Rejected
    public string? ReviewedById { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewNotes { get; set; }
}

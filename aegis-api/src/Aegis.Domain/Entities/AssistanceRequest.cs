using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Entities;

public class AssistanceRequest : BaseEntity
{
    public string TrackingNumber { get; set; } = string.Empty; // e.g., AEG-2026-000123
    public string? CitizenId { get; set; }
    public Guid? CrisisId { get; set; }
    public Crisis? Crisis { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Language { get; set; } = "en"; // en, si, ta
    public string Area { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Submitted;
    public RequestPriority Priority { get; set; } = RequestPriority.Medium;
    public int UrgencyScore { get; set; } = 50; // 0-100
    public Guid? DuplicateOfId { get; set; }
    public AssistanceRequest? DuplicateOf { get; set; }
    public bool ConsentGiven { get; set; } = true;
    public int SelfReportedUrgency { get; set; } = 3; // 1-5 scale
    public int PeopleCount { get; set; } = 1;

    // Citizen request extended metadata
    public string VulnerableFlags { get; set; } = string.Empty;
    public string ContactMobile { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string? RejectionReason { get; set; }
    public string? CancellationReason { get; set; }
    public int? FeedbackRating { get; set; }
    public string? FeedbackComment { get; set; }
    public DateTime? FeedbackSubmittedAt { get; set; }

    // Multilingual NLU normalization (original Description stays untouched)
    public string DetectedLanguage { get; set; } = "en"; // en, si, ta, singlish, mixed
    public string? NormalizedText { get; set; }
    public string? EnglishText { get; set; }
    public string? ExtractedJson { get; set; } // jsonb {needType, peopleCount, locationHints, medicalTerms}
    public double? LanguageConfidence { get; set; }
    public bool AiTranslated { get; set; }

    // Distress detection & staff acknowledgement
    public bool DistressFlagged { get; set; }
    public string? DistressLevel { get; set; } // none, elevated, high
    public string? DistressReason { get; set; }
    public DateTime? DistressDetectedAt { get; set; }
    public DateTime? DistressAcknowledgedAt { get; set; }
    public string? DistressAcknowledgedById { get; set; }

    public ICollection<RequestHistory> Histories { get; set; } = new List<RequestHistory>();
    public ICollection<RequestEvidence> Evidence { get; set; } = new List<RequestEvidence>();
    public ICollection<AiRecommendation> Recommendations { get; set; } = new List<AiRecommendation>();
}

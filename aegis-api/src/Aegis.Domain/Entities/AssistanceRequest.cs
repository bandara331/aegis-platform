using Aegis.Domain.Common;
using Aegis.Domain.Enums;

namespace Aegis.Domain.Entities;

public class AssistanceRequest : BaseEntity
{
    public string TrackingNumber { get; set; } = string.Empty; // e.g., REQ-4821
    public string? CitizenId { get; set; }
    public Guid CrisisId { get; set; }
    public Crisis? Crisis { get; set; }
    public string Category { get; set; } = string.Empty; // Medical, Water, Shelter, Transport, Food
    public string Description { get; set; } = string.Empty;
    public string Language { get; set; } = "en"; // en, si, ta, ar
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

    public ICollection<RequestHistory> Histories { get; set; } = new List<RequestHistory>();
    public ICollection<RequestEvidence> Evidence { get; set; } = new List<RequestEvidence>();
    public ICollection<AiRecommendation> Recommendations { get; set; } = new List<AiRecommendation>();
}

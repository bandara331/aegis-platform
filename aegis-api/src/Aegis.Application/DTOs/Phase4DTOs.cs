namespace Aegis.Application.DTOs;

// Shelters
public record CreateShelterDto(
    string Name,
    string District,
    int Capacity,
    int Occupancy,
    string Facilities,
    string AccessibilityTags,
    double Latitude,
    double Longitude,
    string ContactPerson,
    string ContactPhone
);

public record AllocateShelterDto(
    Guid RequestId,
    int PersonsCount
);

public record ShelterResponseDto(
    Guid Id,
    string Name,
    string District,
    int Capacity,
    int Occupancy,
    int AvailableSpots,
    string Facilities,
    string AccessibilityTags,
    double Latitude,
    double Longitude,
    string ContactPerson,
    string ContactPhone
);

// Resources
public record CreateResourceDto(
    string ItemName,
    string Category,
    int QuantityTotal,
    int QuantityAvailable,
    string Unit,
    string Depot,
    double Latitude,
    double Longitude
);

public record AllocateResourceDto(
    Guid RequestId,
    int Quantity
);

public record ResourceResponseDto(
    Guid Id,
    string ItemName,
    string Category,
    int QuantityTotal,
    int QuantityAvailable,
    string Unit,
    string Depot,
    double Latitude,
    double Longitude
);

public record ResourceDispatchResultDto(
    Guid AllocationId,
    Guid ResourceId,
    Guid RequestId,
    int QuantityDispatched,
    int RemainingStock,
    double DistanceKm,
    int EstimatedMinutes,
    string RouteSource
);

// Shortage Simulation (Strategy Pattern)
public record ShortageScenarioRequestDto(
    string ResourceCategory,
    int AvailableStock,
    string Strategy // "MaxUrgency" | "FairShare" | "FastestEta"
);

public record ScenarioAllocationItemDto(
    Guid RequestId,
    string TrackingNumber,
    string Area,
    string Priority,
    int UrgencyScore,
    int RequestedQuantity,
    int BaselineAllocated,
    int StrategyAllocated,
    double CompositeScore,
    double DistanceKm,
    int EtaMinutes,
    string Explanation
);

public record ShortageScenarioResponseDto(
    string StrategyUsed,
    string ResourceCategory,
    int TotalAvailableStock,
    int TotalRequestedQuantity,
    int UnmetDemand,
    IReadOnlyList<string> ConflictExplanations,
    IReadOnlyList<ScenarioAllocationItemDto> Allocations
);

// Duplicates
public record DuplicateCandidateDto(
    Guid CandidateId,
    string TrackingNumber,
    double JaccardSimilarity,
    double DistanceMeters,
    double HoursApart,
    bool IsLikelyDuplicate,
    string Explanation
);

public record MergeDuplicateRequestDto(
    Guid PrimaryRequestId,
    string Notes
);

// Volunteers
public record CreateVolunteerDto(
    string FullName,
    string PhoneNumber,
    string Skills,
    string Availability,
    double Latitude,
    double Longitude
);

public record MatchVolunteersRequestDto(
    Guid RequestId,
    string RequiredSkills
);

public record VolunteerMatchResultDto(
    Guid VolunteerId,
    string FullName,
    string Skills,
    string Availability,
    double DistanceKm,
    int MatchScore,
    string Explanation
);

public record AssignVolunteerDto(
    Guid VolunteerId,
    Guid RequestId
);

// Donations & Campaigns
public record CreateCampaignDto(
    Guid CrisisId,
    string Title,
    string Description,
    decimal TargetAmount
);

public record CreateDonationDto(
    Guid CampaignId,
    string DonorName,
    string DonorEmail,
    decimal Amount,
    string Currency
);

public record DonationResponseDto(
    Guid Id,
    Guid CampaignId,
    string DonorName,
    decimal Amount,
    string Currency,
    bool Flagged,
    string? FlagReason,
    DateTime CreatedAt
);

// Evidence Upload
public record EvidenceResponseDto(
    Guid Id,
    Guid RequestId,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string Sha256Hash,
    DateTime CreatedAt
);

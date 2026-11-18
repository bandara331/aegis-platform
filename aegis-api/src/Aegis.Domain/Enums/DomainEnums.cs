namespace Aegis.Domain.Enums;

public static class AegisRoles
{
    public const string Citizen = "Citizen";
    public const string EmergencyCoordinator = "EmergencyCoordinator";
    public const string CaseManager = "CaseManager";
    public const string LogisticsManager = "LogisticsManager";
    public const string ShelterAdmin = "ShelterAdmin";
    public const string VolunteerCoordinator = "VolunteerCoordinator";
    public const string DonorOfficer = "DonorOfficer";
    public const string PartnerOfficer = "PartnerOfficer";
    public const string SystemAdmin = "SystemAdmin";

    public static readonly IReadOnlyList<string> All =
    [
        Citizen, EmergencyCoordinator, CaseManager, LogisticsManager,
        ShelterAdmin, VolunteerCoordinator, DonorOfficer, PartnerOfficer, SystemAdmin
    ];
}

public enum CrisisStatus
{
    Active = 1,
    Monitoring = 2,
    Contained = 3,
    Archived = 4
}

public enum RequestStatus
{
    Submitted = 1,
    NeedsReview = 2,
    Assigned = 3,
    Dispatched = 4,
    Fulfilled = 5,
    DuplicateCheck = 6,
    ManualTriage = 7,
    Rejected = 8,
    Closed = 9,
    Approved = 10,
    Cancelled = 11
}

public enum RequestPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

public enum RecommendationStatus
{
    Pending = 1,
    Approved = 2,
    Modified = 3,
    Rejected = 4,
    Deferred = 5
}

public enum DecisionAction
{
    Approve = 1,
    Modify = 2,
    Reject = 3,
    Defer = 4
}

public enum NotificationChannel
{
    Email = 1,
    Sms = 2,
    InApp = 3
}

public enum NotificationStatus
{
    Pending = 1,
    Sent = 2,
    Failed = 3,
    Suppressed = 4
}

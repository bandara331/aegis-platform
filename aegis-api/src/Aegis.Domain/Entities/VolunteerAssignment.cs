using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class VolunteerAssignment : BaseEntity
{
    public Guid VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }
    public Guid RequestId { get; set; }
    public AssistanceRequest? Request { get; set; }
    public string AssignedById { get; set; } = string.Empty;
    public string Status { get; set; } = "Assigned"; // Assigned, InProgress, Completed
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}

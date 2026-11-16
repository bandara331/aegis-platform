using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class ShelterAllocation : BaseEntity
{
    public Guid ShelterId { get; set; }
    public Shelter? Shelter { get; set; }
    public Guid RequestId { get; set; }
    public AssistanceRequest? Request { get; set; }
    public int PersonsAllocated { get; set; }
    public string AllocatedById { get; set; } = string.Empty;
    public DateTime AllocatedAt { get; set; } = DateTime.UtcNow;
}

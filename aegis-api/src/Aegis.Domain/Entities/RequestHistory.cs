using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class RequestHistory : BaseEntity
{
    public Guid RequestId { get; set; }
    public AssistanceRequest? Request { get; set; }
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    public string ChangedById { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

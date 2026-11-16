using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class RequestEvidence : BaseEntity
{
    public Guid RequestId { get; set; }
    public AssistanceRequest? Request { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
}

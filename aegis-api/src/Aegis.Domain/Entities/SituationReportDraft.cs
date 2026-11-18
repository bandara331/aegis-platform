using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

public class SituationReportDraft : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string ContentMarkdown { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft"; // Draft | Published
    public bool IsAiAssisted { get; set; } = true;
    public string CreatedById { get; set; } = string.Empty;
    public string? PublishedById { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

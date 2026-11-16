namespace Aegis.Application.DTOs;

/// <summary>
/// Matches the Next.js frontend contract exactly:
/// GET /api/v1/metrics/kpis returns [{label, value, note, color}]
/// </summary>
public record KpiDto(
    string Label,
    string Value,
    string Note,
    string Color
);

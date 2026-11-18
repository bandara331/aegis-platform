using System.Security.Claims;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aegis.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class AiGovernanceController : ControllerBase
{
    private readonly IAiGovernanceService _governance;

    public AiGovernanceController(IAiGovernanceService governance)
    {
        _governance = governance;
    }

    [HttpGet("ai/status")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var cfg = await _governance.GetCurrentConfigAsync(ct);
        return Ok(new AiStatusDto(
            cfg.Mode,
            cfg.ConfidenceThreshold,
            cfg.FairnessDisparityThreshold,
            cfg.Mode.Equals("Off", StringComparison.OrdinalIgnoreCase),
            cfg.Mode.Equals("Shadow", StringComparison.OrdinalIgnoreCase)));
    }

    [HttpGet("admin/ai/governance")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> GetGovernance(CancellationToken ct)
    {
        var view = await _governance.GetGovernanceViewAsync(ct);
        return Ok(view);
    }

    [HttpPut("admin/ai/governance")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateGovernance([FromBody] UpdateAiGovernanceDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 5)
            return BadRequest(new { message = "A reason of at least 5 characters is required for AI governance changes." });

        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.Identity?.Name ?? "SystemAdmin";
        var updated = await _governance.UpdateGovernanceAsync(dto, actorId, ct);
        return Ok(updated);
    }

    [HttpGet("admin/ai/analytics")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> GetAnalytics([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var analytics = await _governance.GetAnalyticsAsync(from, to, ct);
        return Ok(analytics);
    }
}

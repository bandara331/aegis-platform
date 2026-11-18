using System.Security.Claims;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Api.Controllers;

[ApiController]
[Route("api/v1/ai")]
[Authorize(Policy = "StaffOnly")]
public class AiCopilotController : ControllerBase
{
    private readonly IAiCopilotService _copilot;
    private readonly IPredictionService _prediction;
    private readonly AiRateLimiter _rateLimiter;
    private readonly AegisDbContext _context;
    private readonly IAuditService _audit;
    private readonly InMemoryRealtimeSignalPublisher _signals;

    public AiCopilotController(
        IAiCopilotService copilot,
        IPredictionService prediction,
        AiRateLimiter rateLimiter,
        AegisDbContext context,
        IAuditService audit,
        InMemoryRealtimeSignalPublisher signals)
    {
        _copilot = copilot;
        _prediction = prediction;
        _rateLimiter = rateLimiter;
        _context = context;
        _audit = audit;
        _signals = signals;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.Identity?.Name ?? "staff";

    private async Task<Guid?> ResolveRequestGuidAsync(string idOrTracking, CancellationToken ct)
    {
        if (Guid.TryParse(idOrTracking, out var guid)) return guid;
        var norm = idOrTracking.Trim().ToUpperInvariant();
        var req = await _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.TrackingNumber.ToUpper() == norm)
            .Select(r => new { r.Id })
            .FirstOrDefaultAsync(ct);
        return req?.Id;
    }

    [HttpPost("chat/{idOrTracking}/summary")]
    public async Task<IActionResult> SummarizeChat(string idOrTracking, CancellationToken ct)
    {
        if (!_rateLimiter.TryAcquire($"copilot:{CurrentUserId}"))
            return StatusCode(429, new { message = "AI copilot rate limit exceeded. Please wait a moment." });

        var requestId = await ResolveRequestGuidAsync(idOrTracking, ct);
        if (requestId == null) return NotFound();
        return Ok(await _copilot.SummarizeChatAsync(requestId.Value, CurrentUserId, ct));
    }

    [HttpPost("chat/{idOrTracking}/suggest-reply")]
    public async Task<IActionResult> SuggestReply(string idOrTracking, CancellationToken ct)
    {
        if (!_rateLimiter.TryAcquire($"copilot:{CurrentUserId}"))
            return StatusCode(429, new { message = "AI copilot rate limit exceeded. Please wait a moment." });

        var requestId = await ResolveRequestGuidAsync(idOrTracking, ct);
        if (requestId == null) return NotFound();
        return Ok(await _copilot.SuggestReplyAsync(requestId.Value, CurrentUserId, ct));
    }

    [HttpGet("handover")]
    public async Task<IActionResult> Handover([FromQuery] DateTime? since, CancellationToken ct)
    {
        var sinceUtc = since?.ToUniversalTime() ?? DateTime.UtcNow.AddHours(-8);
        return Ok(await _copilot.GenerateHandoverAsync(CurrentUserId, sinceUtc, ct));
    }

    [HttpPost("search")]
    public async Task<IActionResult> Search([FromBody] NlSearchRequestDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Query))
            return BadRequest(new { message = "Query cannot be empty." });

        if (!_rateLimiter.TryAcquire($"search:{CurrentUserId}"))
            return StatusCode(429, new { message = "AI search rate limit exceeded. Please wait a moment." });

        return Ok(await _copilot.NaturalLanguageSearchAsync(dto.Query, CurrentUserId, ct));
    }

    [HttpPost("reports/daily-draft")]
    public async Task<IActionResult> CreateDailyDraft(CancellationToken ct)
    {
        if (!_rateLimiter.TryAcquire($"report:{CurrentUserId}"))
            return StatusCode(429, new { message = "AI report rate limit exceeded. Please wait a moment." });

        return Ok(await _copilot.GenerateDailySituationDraftAsync(CurrentUserId, ct));
    }

    [HttpGet("reports/drafts")]
    public async Task<IActionResult> ListDrafts(CancellationToken ct) =>
        Ok(await _copilot.ListSituationDraftsAsync(ct));

    [HttpPut("reports/drafts/{id:guid}")]
    public async Task<IActionResult> UpdateDraft(Guid id, [FromBody] UpdateSituationReportDraftDto dto, CancellationToken ct)
    {
        var res = await _copilot.UpdateSituationDraftAsync(id, dto, CurrentUserId, ct);
        return res.IsFailure ? BadRequest(new { message = res.Error }) : Ok(res.Value);
    }

    [HttpPost("reports/drafts/{id:guid}/publish")]
    [Authorize(Policy = "CanDecide")]
    public async Task<IActionResult> PublishDraft(Guid id, CancellationToken ct)
    {
        var res = await _copilot.PublishSituationDraftAsync(id, CurrentUserId, ct);
        return res.IsFailure ? BadRequest(new { message = res.Error }) : Ok(res.Value);
    }

    [HttpPost("distress/{idOrTracking}/acknowledge")]
    public async Task<IActionResult> AcknowledgeDistress(string idOrTracking, CancellationToken ct)
    {
        var requestId = await ResolveRequestGuidAsync(idOrTracking, ct);
        if (requestId == null) return NotFound();
        var req = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == requestId.Value, ct);
        if (req == null) return NotFound();

        req.DistressAcknowledgedAt = DateTime.UtcNow;
        req.DistressAcknowledgedById = CurrentUserId;
        await _context.SaveChangesAsync(ct);

        await _audit.AppendAsync("AssistanceRequest", req.Id.ToString(), "DistressAcknowledged", CurrentUserId, "Staff",
            new { req.TrackingNumber, req.DistressLevel }, ct);

        return Ok(new { acknowledged = true, acknowledgedAt = req.DistressAcknowledgedAt });
    }

    [HttpGet("forecast/stock")]
    public async Task<IActionResult> StockForecast(CancellationToken ct) =>
        Ok(await _prediction.GetStockForecastsAsync(ct));

    [HttpGet("risk/districts")]
    public async Task<IActionResult> DistrictRisk(CancellationToken ct) =>
        Ok(await _prediction.GetDistrictRiskAsync(ct));

    [HttpPost("risk/refresh")]
    public async Task<IActionResult> RefreshDistrictRisk(CancellationToken ct) =>
        Ok(await _prediction.RefreshDistrictRiskAsync(ct));

    [HttpGet("signals/stream")]
    public async Task StreamSignals(CancellationToken ct)
    {
        Response.Headers.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        var (subId, reader) = _signals.Subscribe();
        try
        {
            await foreach (var msg in reader.ReadAllAsync(ct))
            {
                await Response.WriteAsync($"data: {msg}\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        finally
        {
            _signals.Unsubscribe(subId);
        }
    }
}

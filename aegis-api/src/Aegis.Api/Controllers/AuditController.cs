using Aegis.Application.DTOs;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Api.Controllers;

[ApiController]
[Route("api/v1/audit")]
[Authorize(Policy = "AuditAccess")]
public class AuditController : ControllerBase
{
    private readonly AegisDbContext _context;
    private readonly IAuditService _audit;

    public AuditController(AegisDbContext context, IAuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    /// <summary>Paginated audit log, newest first.</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var total = await _context.AuditLogEntries.CountAsync(ct);
        var items = await _context.AuditLogEntries.AsNoTracking()
            .OrderByDescending(a => a.SequenceNumber)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new AuditEntryDto(a.SequenceNumber, a.EntityName, a.EntityId, a.Action, a.ActorId,
                a.ActorRole, a.DetailsJson, a.PreviousHash, a.CurrentHash, a.TimestampUtc))
            .ToListAsync(ct);

        return Ok(new { page, pageSize, total, items });
    }

    /// <summary>Recomputes the hash chain and returns the first broken entry, if any.</summary>
    [HttpGet("verify")]
    public async Task<IActionResult> Verify(CancellationToken ct)
    {
        var (isValid, broken, error) = await _audit.VerifyChainAsync(ct);
        var total = await _context.AuditLogEntries.CountAsync(ct);
        return Ok(new AuditVerifyDto(isValid, broken, error, total));
    }
}

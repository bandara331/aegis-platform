using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public class RequestService : IRequestService
{
    private readonly AegisDbContext _context;
    private readonly IAiProvider _aiProvider;
    private readonly IAuditService _auditService;
    private readonly ILogger<RequestService> _logger;

    public RequestService(
        AegisDbContext context,
        IAiProvider aiProvider,
        IAuditService auditService,
        ILogger<RequestService> logger)
    {
        _context = context;
        _aiProvider = aiProvider;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<RequestResponseDto> CreateRequestAsync(
        CreateRequestDto dto,
        string? citizenId,
        string? idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        // Check idempotency if key was provided
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingRecord = await _context.IdempotencyRecords
                .FirstOrDefaultAsync(i => i.Key == idempotencyKey, cancellationToken);

            if (existingRecord != null && !string.IsNullOrWhiteSpace(existingRecord.ResponseBody))
            {
                var cached = JsonSerializer.Deserialize<RequestResponseDto>(existingRecord.ResponseBody);
                if (cached != null) return cached;
            }
        }

        // Generate sequential tracking number from real DB count
        var count = await _context.AssistanceRequests.IgnoreQueryFilters().CountAsync(cancellationToken);
        var trackingNumber = $"REQ-{count + 1:D4}";

        var request = new AssistanceRequest
        {
            TrackingNumber = trackingNumber,
            CitizenId = citizenId,
            CrisisId = dto.CrisisId,
            Category = dto.Category,
            Description = dto.Description,
            Language = dto.Language ?? "en",
            Area = dto.Area,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            SelfReportedUrgency = dto.SelfReportedUrgency,
            PeopleCount = dto.PeopleCount,
            ConsentGiven = dto.ConsentGiven,
            Status = RequestStatus.NeedsReview,
            CreatedAt = DateTime.UtcNow
        };

        // Check if AiEngine is currently in simulated or real Degraded/Unhealthy state
        var aiHealth = await _context.ServiceHealths.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ServiceName == "AiEngine", cancellationToken);
        var aiDegraded = aiHealth != null && !aiHealth.Status.Equals("Healthy", StringComparison.OrdinalIgnoreCase);

        // Score with AI provider
        var scoring = await _aiProvider.ScoreUrgencyAsync(request, cancellationToken);
        request.Priority = scoring.Priority;
        request.UrgencyScore = (int)(scoring.Confidence * 100);
        if (aiDegraded)
        {
            request.Status = RequestStatus.ManualTriage;
        }

        var recommendation = new AiRecommendation
        {
            RequestId = request.Id,
            ModelName = scoring.ModelName,
            ModelVersion = scoring.ModelVersion,
            Priority = scoring.Priority,
            Confidence = scoring.Confidence,
            RationaleJson = scoring.RationaleJson,
            FeatureScoresJson = scoring.FeatureScoresJson,
            Status = RecommendationStatus.Pending
        };

        request.Recommendations.Add(recommendation);

        // Outbox Pattern: queue localized notification in the same transaction
        var outbox = NotificationFactory.CreateRequestReceivedNotification(request, citizenId ?? "citizen@aegis.local");
        if (!await _context.NotificationOutboxes.AnyAsync(n => n.IdempotencyKey == outbox.IdempotencyKey, cancellationToken))
        {
            _context.NotificationOutboxes.Add(outbox);
        }

        _context.AssistanceRequests.Add(request);
        await _context.SaveChangesAsync(cancellationToken);

        // Audit the creation
        await _auditService.AppendAsync(
            "AssistanceRequest",
            request.Id.ToString(),
            "Create",
            citizenId ?? "AnonymousCitizen",
            "Citizen",
            new { trackingNumber, category = request.Category, priority = request.Priority.ToString(), urgency = request.UrgencyScore },
            cancellationToken
        );

        var response = MapToDto(request);

        // Save idempotency record if requested
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            _context.IdempotencyRecords.Add(new IdempotencyRecord
            {
                Key = idempotencyKey,
                RequestPath = "/api/v1/requests",
                StatusCode = 201,
                ResponseBody = JsonSerializer.Serialize(response),
                ExpiresAtUtc = DateTime.UtcNow.AddHours(24)
            });
            await _context.SaveChangesAsync(cancellationToken);
        }

        return response;
    }

    public async Task<RequestResponseDto?> GetByIdAsync(
        Guid id,
        string? currentUserId,
        string currentUserRole,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.AssistanceRequests
            .Include(r => r.Recommendations)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null) return null;

        // Resource-based authorization check: Citizens can ONLY view their own requests
        if (currentUserRole == AegisRoles.Citizen && request.CitizenId != currentUserId)
        {
            throw new UnauthorizedAccessException("Citizens can only inspect their own submitted assistance requests.");
        }

        return MapToDto(request);
    }

    public async Task<IReadOnlyList<RequestResponseDto>> GetAllAsync(
        string? status,
        string? priority,
        string? currentUserId,
        string currentUserRole,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AssistanceRequests.AsNoTracking();

        // Citizens can ONLY view their own requests
        if (currentUserRole == AegisRoles.Citizen)
        {
            query = query.Where(r => r.CitizenId == currentUserId);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RequestStatus>(status, true, out var st))
        {
            query = query.Where(r => r.Status == st);
        }

        if (!string.IsNullOrWhiteSpace(priority) && Enum.TryParse<RequestPriority>(priority, true, out var pr))
        {
            query = query.Where(r => r.Priority == pr);
        }

        var list = await query.OrderByDescending(r => r.UrgencyScore).ToListAsync(cancellationToken);
        return list.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<CaseItemDto>> GetCasesQueueAsync(string? sort, CancellationToken cancellationToken = default)
    {
        var query = _context.AssistanceRequests.AsNoTracking();

        // Sort by AI priority / score by default
        query = sort switch
        {
            "wait" => query.OrderBy(r => r.CreatedAt),
            "area" => query.OrderBy(r => r.Area),
            _ => query.OrderByDescending(r => r.UrgencyScore).ThenBy(r => r.CreatedAt)
        };

        var requests = await query.Take(50).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;

        return requests.Select(r =>
        {
            var waitSpan = now - r.CreatedAt;
            var waitStr = waitSpan.TotalHours >= 1
                ? $"{(int)waitSpan.TotalHours}h {waitSpan.Minutes:D2}m"
                : $"{Math.Max(1, (int)waitSpan.TotalMinutes)}m";

            var priorityClass = r.Priority switch
            {
                RequestPriority.Critical => "critical",
                RequestPriority.High => "high",
                _ => "medium"
            };

            var statusStr = r.Status switch
            {
                RequestStatus.NeedsReview => "Needs review",
                RequestStatus.Assigned => "Assigned",
                RequestStatus.Dispatched => "Dispatched",
                RequestStatus.DuplicateCheck => "Duplicate check",
                RequestStatus.ManualTriage => "Manual triage",
                RequestStatus.Fulfilled => "Fulfilled",
                RequestStatus.Closed => "Closed",
                _ => "Submitted"
            };

            return new CaseItemDto(
                Id: r.TrackingNumber,
                Need: $"{r.Category}: {r.Description}",
                Area: r.Area,
                Wait: waitStr,
                Priority: priorityClass,
                Score: r.UrgencyScore,
                Status: statusStr,
                Selected: false
            );
        }).ToList();
    }

    private static RequestResponseDto MapToDto(AssistanceRequest r)
    {
        return new RequestResponseDto(
            r.Id,
            r.TrackingNumber,
            r.CitizenId,
            r.CrisisId,
            r.Category,
            r.Description,
            r.Language,
            r.Area,
            r.Latitude,
            r.Longitude,
            r.Status.ToString(),
            r.Priority.ToString(),
            r.UrgencyScore,
            r.DuplicateOfId,
            r.PeopleCount,
            r.CreatedAt
        );
    }
}

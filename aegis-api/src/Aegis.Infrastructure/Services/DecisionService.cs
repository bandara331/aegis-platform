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

public class DecisionService : IDecisionService
{
    private readonly AegisDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<DecisionService> _logger;

    public DecisionService(
        AegisDbContext context,
        IAuditService auditService,
        ILogger<DecisionService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<DecisionResponseDto> RecordDecisionAsync(
        Guid recommendationId,
        DecisionRequestDto dto,
        string decidedById,
        string decidedByRole,
        CancellationToken cancellationToken = default)
    {
        var recommendation = await _context.AiRecommendations
            .Include(r => r.Request)
            .FirstOrDefaultAsync(r => r.Id == recommendationId, cancellationToken);

        if (recommendation == null)
        {
            throw new KeyNotFoundException($"AiRecommendation with ID '{recommendationId}' was not found.");
        }

        if (recommendation.Request == null)
        {
            throw new InvalidOperationException("Associated AssistanceRequest could not be found.");
        }

        if (!Enum.TryParse<DecisionAction>(dto.Action, true, out var action))
        {
            throw new InvalidOperationException($"Invalid action '{dto.Action}'. Must be Approve, Modify, Reject, or Defer.");
        }

        // Rule 1: Justification required for Modify and Reject
        if ((action == DecisionAction.Modify || action == DecisionAction.Reject) && string.IsNullOrWhiteSpace(dto.Justification))
        {
            throw new InvalidOperationException("A justification is mandatory when modifying or rejecting an AI recommendation.");
        }

        // Rule 2: Critical actions require a second, different authorised approver
        var isCritical = recommendation.Priority == RequestPriority.Critical ||
                         recommendation.Request.Category.Equals("Medical", StringComparison.OrdinalIgnoreCase);

        if (isCritical)
        {
            if (string.IsNullOrWhiteSpace(dto.SecondApproverId))
            {
                throw new InvalidOperationException("Critical decisions (critical priority or medicine dispatch) strictly require a Second Approver ID.");
            }

            if (dto.SecondApproverId.Equals(decidedById, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Integrity violation: The second approver must be a different individual than the primary decision-maker.");
            }
        }

        var decision = new Decision
        {
            RecommendationId = recommendation.Id,
            Action = action,
            DecidedById = decidedById,
            Justification = dto.Justification ?? string.Empty,
            SecondApproverId = isCritical ? dto.SecondApproverId : null,
            DecidedAt = DateTime.UtcNow,
            IsCriticalAction = isCritical
        };

        // State Transition: AI advises, humans decide!
        switch (action)
        {
            case DecisionAction.Approve:
                recommendation.Status = RecommendationStatus.Approved;
                recommendation.Request.Status = RequestStatus.Assigned;
                break;
            case DecisionAction.Modify:
                recommendation.Status = RecommendationStatus.Modified;
                if (!string.IsNullOrWhiteSpace(dto.OverridePriority) && Enum.TryParse<RequestPriority>(dto.OverridePriority, true, out var pri))
                {
                    recommendation.Request.Priority = pri;
                }
                recommendation.Request.Status = RequestStatus.Assigned;
                break;
            case DecisionAction.Reject:
                recommendation.Status = RecommendationStatus.Rejected;
                recommendation.Request.Status = RequestStatus.Rejected;
                break;
            case DecisionAction.Defer:
                recommendation.Status = RecommendationStatus.Deferred;
                recommendation.Request.Status = RequestStatus.ManualTriage;
                break;
        }

        _context.Decisions.Add(decision);

        // Outbox Pattern: queue localized decision notification in the same transaction
        var outbox = NotificationFactory.CreateDecisionNotification(recommendation.Request, decision, recommendation.Request.CitizenId ?? "citizen@aegis.local");
        if (!await _context.NotificationOutboxes.AnyAsync(n => n.IdempotencyKey == outbox.IdempotencyKey, cancellationToken))
        {
            _context.NotificationOutboxes.Add(outbox);
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Append to append-only tamper-evident audit log
        await _auditService.AppendAsync(
            "Decision",
            decision.Id.ToString(),
            action.ToString(),
            decidedById,
            decidedByRole,
            new
            {
                recommendationId = recommendation.Id,
                requestTrackingNumber = recommendation.Request.TrackingNumber,
                action = action.ToString(),
                isCritical,
                secondApproverId = decision.SecondApproverId,
                justification = decision.Justification
            },
            cancellationToken
        );

        _logger.LogInformation("Decision {Action} recorded for recommendation {RecommendationId} by {DecidedById}",
            action, recommendation.Id, decidedById);

        return new DecisionResponseDto(
            decision.Id,
            recommendation.Id,
            action.ToString(),
            decidedById,
            decision.SecondApproverId,
            decision.DecidedAt,
            recommendation.Request.Status.ToString(),
            $"Decision '{action}' successfully recorded and sealed in the cryptographic audit chain."
        );
    }

    public async Task<IReadOnlyList<AiRecommendationDto>> GetPendingRecommendationsAsync(CancellationToken cancellationToken = default)
    {
        var recs = await _context.AiRecommendations
            .Include(r => r.Request)
            .Where(r => r.Status == RecommendationStatus.Pending)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return recs.Select(r => new AiRecommendationDto(
            r.Id,
            r.RequestId,
            r.Request?.TrackingNumber ?? "UNKNOWN",
            r.ModelName,
            r.ModelVersion,
            r.Priority.ToString(),
            r.Confidence,
            r.RationaleJson,
            r.FeatureScoresJson,
            r.Status.ToString(),
            r.CreatedAt
        )).ToList();
    }
}

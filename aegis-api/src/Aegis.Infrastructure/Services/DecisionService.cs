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

        // Rule 1: Justification required for Modify and Reject (Edit action maps to Modify)
        if ((action == DecisionAction.Modify || action == DecisionAction.Reject) && string.IsNullOrWhiteSpace(dto.Justification))
        {
            throw new InvalidOperationException("A justification is mandatory when editing or rejecting an AI recommendation.");
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

        var prevStatusLabel = RequestService.FormatCitizenStatus(recommendation.Request.Status);

        // State Transition: AI advises, humans decide!
        switch (action)
        {
            case DecisionAction.Approve:
                recommendation.Status = RecommendationStatus.Approved;
                recommendation.Request.Status = RequestStatus.Assigned;
                _context.RequestHistories.Add(new RequestHistory
                {
                    RequestId = recommendation.Request.Id,
                    FromStatus = prevStatusLabel,
                    ToStatus = "Approved",
                    ChangedById = decidedById,
                    Notes = string.IsNullOrWhiteSpace(decision.Justification)
                        ? "Approved by coordinator."
                        : decision.Justification,
                    CreatedAt = DateTime.UtcNow
                });
                _context.RequestHistories.Add(new RequestHistory
                {
                    RequestId = recommendation.Request.Id,
                    FromStatus = "Approved",
                    ToStatus = "Assigned",
                    ChangedById = decidedById,
                    Notes = "Assigned to field dispatch queue following coordinator approval.",
                    CreatedAt = DateTime.UtcNow
                });
                break;
            case DecisionAction.Modify:
                recommendation.Status = RecommendationStatus.Modified;
                if (!string.IsNullOrWhiteSpace(dto.OverridePriority) && Enum.TryParse<RequestPriority>(dto.OverridePriority, true, out var pri))
                {
                    recommendation.Request.Priority = pri;
                }
                recommendation.Request.Status = RequestStatus.Assigned;
                _context.RequestHistories.Add(new RequestHistory
                {
                    RequestId = recommendation.Request.Id,
                    FromStatus = prevStatusLabel,
                    ToStatus = "Assigned",
                    ChangedById = decidedById,
                    Notes = decision.Justification,
                    CreatedAt = DateTime.UtcNow
                });
                break;
            case DecisionAction.Reject:
                recommendation.Status = RecommendationStatus.Rejected;
                recommendation.Request.Status = RequestStatus.Rejected;
                recommendation.Request.RejectionReason = decision.Justification;
                _context.RequestHistories.Add(new RequestHistory
                {
                    RequestId = recommendation.Request.Id,
                    FromStatus = prevStatusLabel,
                    ToStatus = "Rejected",
                    ChangedById = decidedById,
                    Notes = decision.Justification,
                    CreatedAt = DateTime.UtcNow
                });
                break;
            case DecisionAction.Defer:
                recommendation.Status = RecommendationStatus.Deferred;
                recommendation.Request.Status = RequestStatus.ManualTriage;
                _context.RequestHistories.Add(new RequestHistory
                {
                    RequestId = recommendation.Request.Id,
                    FromStatus = prevStatusLabel,
                    ToStatus = "Under review",
                    ChangedById = decidedById,
                    Notes = string.IsNullOrWhiteSpace(decision.Justification)
                        ? "Deferred for manual coordinator triage."
                        : decision.Justification,
                    CreatedAt = DateTime.UtcNow
                });
                break;
        }

        // Automatic system message in the chat conversation
        var chatMsgText = action switch
        {
            DecisionAction.Approve => "System: Your assistance request was approved by the coordinator and assigned for field relief dispatch.",
            DecisionAction.Reject => $"System: Request reviewed by coordinator. Outcome: Not approved. Reason: {decision.Justification}",
            DecisionAction.Modify => $"System: Coordinator edited response plan: {decision.Justification}. Priority set to {recommendation.Request.Priority}.",
            DecisionAction.Defer => "System: Request deferred for secondary senior coordinator triage.",
            _ => $"System: Decision recorded: {action}."
        };

        _context.RequestHistories.Add(new RequestHistory
        {
            RequestId = recommendation.Request.Id,
            FromStatus = "Chat",
            ToStatus = "Chat",
            ChangedById = "System",
            Notes = chatMsgText,
            CreatedAt = DateTime.UtcNow
        });

        _context.Decisions.Add(decision);

        // Resolve citizen email from request ContactEmail or Users table
        var recipientEmail = recommendation.Request.ContactEmail;
        if (string.IsNullOrWhiteSpace(recipientEmail) && !string.IsNullOrWhiteSpace(recommendation.Request.CitizenId))
        {
            var user = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == recommendation.Request.CitizenId, cancellationToken);
            if (!string.IsNullOrWhiteSpace(user?.Email))
            {
                recipientEmail = user.Email!;
            }
        }
        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            recipientEmail = recommendation.Request.CitizenId ?? "citizen@aegis.local";
        }

        // Outbox Pattern: queue localized decision notification in the same transaction
        var outbox = NotificationFactory.CreateDecisionNotification(recommendation.Request, decision, recipientEmail);
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
                aiRecommendation = recommendation.Priority.ToString(),
                confidence = recommendation.Confidence,
                humanAction = action.ToString(),
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

    public async Task<AiRecommendationDto?> GetLatestForRequestAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var r = await _context.AiRecommendations
            .Include(x => x.Request)
            .Where(x => x.RequestId == requestId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (r == null) return null;
        return new AiRecommendationDto(r.Id, r.RequestId, r.Request?.TrackingNumber ?? "UNKNOWN", r.ModelName, r.ModelVersion,
            r.Priority.ToString(), r.Confidence, r.RationaleJson, r.FeatureScoresJson, r.Status.ToString(), r.CreatedAt);
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

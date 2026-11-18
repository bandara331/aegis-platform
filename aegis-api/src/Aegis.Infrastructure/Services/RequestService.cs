using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
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

    public async Task<CitizenContactProfileDto?> GetCitizenProfileAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null) return null;

        return new CitizenContactProfileDto(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            user.PhoneNumber ?? string.Empty,
            user.PreferredLanguage ?? "en"
        );
    }

    public async Task<DuplicateWarningDto?> CheckCitizenDuplicateAsync(
        CreateRequestDto dto,
        string? citizenId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(citizenId) || dto.ConfirmDuplicate)
        {
            return null;
        }

        var openCandidates = await _context.AssistanceRequests.AsNoTracking()
            .Where(r => r.CitizenId == citizenId &&
                        r.Status != RequestStatus.Fulfilled &&
                        r.Status != RequestStatus.Closed &&
                        r.Status != RequestStatus.Rejected &&
                        r.Status != RequestStatus.Cancelled)
            .OrderByDescending(r => r.CreatedAt)
            .Take(15)
            .ToListAsync(cancellationToken);

        foreach (var existing in openCandidates)
        {
            var distMeters = DuplicateDetector.ComputeHaversineMeters(
                dto.Latitude, dto.Longitude, existing.Latitude, existing.Longitude);

            var sameCategory = existing.Category.Equals(dto.Category, StringComparison.OrdinalIgnoreCase) ||
                               existing.Category.Contains(dto.Category, StringComparison.OrdinalIgnoreCase) ||
                               dto.Category.Contains(existing.Category, StringComparison.OrdinalIgnoreCase);

            var jaccard = DuplicateDetector.ComputeTokenJaccard(
                $"{dto.Category} {dto.Description}",
                $"{existing.Category} {existing.Description}");

            var sameArea = !string.IsNullOrWhiteSpace(dto.Area) &&
                           existing.Area.Equals(dto.Area, StringComparison.OrdinalIgnoreCase);

            if ((distMeters <= 1000.0 || sameArea) && (sameCategory || jaccard >= 0.25))
            {
                return new DuplicateWarningDto(
                    existing.Id,
                    existing.TrackingNumber,
                    existing.Category,
                    existing.Area,
                    FormatCitizenStatus(existing.Status),
                    Math.Round(distMeters, 0),
                    existing.CreatedAt,
                    $"You already have an open {existing.Category} request ({existing.TrackingNumber}) nearby in {existing.Area}."
                );
            }
        }

        return null;
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

        // Resolve optional CrisisId only if it exists in the DB
        Guid? resolvedCrisisId = null;
        if (dto.CrisisId.HasValue && dto.CrisisId.Value != Guid.Empty)
        {
            var exists = await _context.Crises.AnyAsync(c => c.Id == dto.CrisisId.Value, cancellationToken);
            if (exists) resolvedCrisisId = dto.CrisisId.Value;
        }
        if (!resolvedCrisisId.HasValue)
        {
            var activeCrisis = await _context.Crises.AsNoTracking()
                .Where(c => c.Status == CrisisStatus.Active)
                .OrderByDescending(c => c.DeclaredAt)
                .FirstOrDefaultAsync(cancellationToken);
            if (activeCrisis != null) resolvedCrisisId = activeCrisis.Id;
        }

        // Resolve citizen contact details from database if not supplied
        var contactEmail = dto.ContactEmail?.Trim() ?? string.Empty;
        var contactMobile = dto.ContactMobile?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(citizenId) && (string.IsNullOrWhiteSpace(contactEmail) || string.IsNullOrWhiteSpace(contactMobile)))
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == citizenId, cancellationToken);
            if (user != null)
            {
                if (string.IsNullOrWhiteSpace(contactEmail)) contactEmail = user.Email ?? string.Empty;
                if (string.IsNullOrWhiteSpace(contactMobile)) contactMobile = user.PhoneNumber ?? string.Empty;
            }
        }

        // Generate readable sequential reference number (e.g. AEG-2026-000123)
        var count = await _context.AssistanceRequests.IgnoreQueryFilters().CountAsync(cancellationToken);
        var year = DateTime.UtcNow.Year;
        var trackingNumber = $"AEG-{year}-{count + 1:D6}";

        var request = new AssistanceRequest
        {
            TrackingNumber = trackingNumber,
            CitizenId = citizenId,
            CrisisId = resolvedCrisisId,
            Category = dto.Category,
            Description = dto.Description,
            Language = dto.Language ?? "en",
            Area = dto.Area,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            SelfReportedUrgency = dto.SelfReportedUrgency,
            PeopleCount = dto.PeopleCount,
            ConsentGiven = dto.ConsentGiven,
            VulnerableFlags = dto.VulnerableFlags?.Trim() ?? string.Empty,
            ContactMobile = contactMobile,
            ContactEmail = contactEmail,
            Status = RequestStatus.NeedsReview,
            CreatedAt = DateTime.UtcNow
        };

        // Record initial status timeline history
        request.Histories.Add(new RequestHistory
        {
            RequestId = request.Id,
            FromStatus = "New",
            ToStatus = "Under review",
            ChangedById = citizenId ?? "Citizen",
            Notes = "Request submitted by citizen and queued for coordinator review.",
            CreatedAt = DateTime.UtcNow
        });

        // Check if AiEngine is currently in Degraded/Unhealthy state
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

        // Outbox Pattern: queue localized "request received" email in the same transaction
        var recipientEmail = !string.IsNullOrWhiteSpace(contactEmail)
            ? contactEmail
            : (citizenId ?? "citizen@aegis.local");

        var outbox = NotificationFactory.CreateRequestReceivedNotification(request, recipientEmail);
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
            .Include(r => r.Histories)
            .Include(r => r.Evidence)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null) return null;

        if (currentUserRole == AegisRoles.Citizen && request.CitizenId != currentUserId)
        {
            throw new UnauthorizedAccessException("Citizens can only inspect their own submitted assistance requests.");
        }

        return MapToDto(request);
    }

    public async Task<RequestResponseDto?> GetByIdOrTrackingAsync(
        string idOrTracking,
        string? currentUserId,
        string currentUserRole,
        CancellationToken cancellationToken = default)
    {
        AssistanceRequest? request;
        if (Guid.TryParse(idOrTracking, out var guid))
        {
            request = await _context.AssistanceRequests
                .Include(r => r.Recommendations)
                .Include(r => r.Histories)
                .Include(r => r.Evidence)
                .FirstOrDefaultAsync(r => r.Id == guid, cancellationToken);
        }
        else
        {
            var normalized = idOrTracking.Trim().ToUpperInvariant();
            request = await _context.AssistanceRequests
                .Include(r => r.Recommendations)
                .Include(r => r.Histories)
                .Include(r => r.Evidence)
                .FirstOrDefaultAsync(r => r.TrackingNumber.ToUpper() == normalized, cancellationToken);
        }

        if (request == null) return null;

        if (currentUserRole == AegisRoles.Citizen && request.CitizenId != currentUserId)
        {
            throw new UnauthorizedAccessException("Citizens can only inspect their own submitted assistance requests.");
        }

        string? maskedNic = null;
        if (!string.IsNullOrWhiteSpace(request.CitizenId))
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.CitizenId, cancellationToken);
            maskedNic = user?.MaskedNic;
        }

        return MapToDto(request, maskedNic);
    }

    public async Task<IReadOnlyList<RequestResponseDto>> GetAllAsync(
        string? status,
        string? priority,
        string? currentUserId,
        string currentUserRole,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AssistanceRequests
            .Include(r => r.Recommendations)
            .Include(r => r.Histories)
            .Include(r => r.Evidence)
            .AsNoTracking();

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

        var list = await query
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.UrgencyScore)
            .ToListAsync(cancellationToken);
        return list.Select(r => MapToDto(r, null)).ToList();
    }

    public async Task<PagedRequestsDto> GetPagedAsync(
        string? search,
        string? status,
        string? priority,
        string? district,
        string? language,
        int page,
        int pageSize,
        string? currentUserId,
        string currentUserRole,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AssistanceRequests
            .Include(r => r.Recommendations)
            .Include(r => r.Histories)
            .Include(r => r.Evidence)
            .AsNoTracking();

        if (currentUserRole == AegisRoles.Citizen)
        {
            query = query.Where(r => r.CitizenId == currentUserId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r =>
                r.TrackingNumber.ToLower().Contains(s) ||
                r.Description.ToLower().Contains(s) ||
                r.Area.ToLower().Contains(s) ||
                r.Category.ToLower().Contains(s) ||
                r.ContactMobile.ToLower().Contains(s) ||
                r.ContactEmail.ToLower().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var sClean = status.Replace(" ", "").ToLower();
            query = query.Where(r => r.Status.ToString().ToLower() == sClean);
        }

        if (!string.IsNullOrWhiteSpace(priority) && !priority.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var pClean = priority.ToLower();
            query = query.Where(r => r.Priority.ToString().ToLower() == pClean);
        }

        if (!string.IsNullOrWhiteSpace(district) && !district.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var d = district.Trim().ToLower();
            query = query.Where(r => r.Area.ToLower().Contains(d));
        }

        if (!string.IsNullOrWhiteSpace(language) && !language.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var l = language.Trim().ToLower();
            query = query.Where(r => r.Language.ToLower() == l);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var validPage = Math.Max(1, page);
        var validPageSize = Math.Clamp(pageSize, 1, 100);
        var totalPages = (int)Math.Ceiling(totalCount / (double)validPageSize);

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((validPage - 1) * validPageSize)
            .Take(validPageSize)
            .ToListAsync(cancellationToken);

        var dtos = new List<RequestResponseDto>(items.Count);
        foreach (var r in items)
        {
            string? maskedNic = null;
            if (!string.IsNullOrWhiteSpace(r.CitizenId))
            {
                var user = await _context.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == r.CitizenId, cancellationToken);
                maskedNic = user?.MaskedNic;
            }
            dtos.Add(MapToDto(r, maskedNic));
        }

        return new PagedRequestsDto(dtos, totalCount, validPage, validPageSize, totalPages);
    }

    public async Task<Result<RequestResponseDto>> CancelRequestAsync(
        Guid id,
        string? reason,
        string citizenId,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.AssistanceRequests
            .Include(r => r.Histories)
            .Include(r => r.Evidence)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null)
        {
            return Result<RequestResponseDto>.Failure("Request not found.");
        }

        if (request.CitizenId != citizenId)
        {
            return Result<RequestResponseDto>.Failure("You can only cancel your own assistance request.");
        }

        if (!IsCancellable(request.Status))
        {
            return Result<RequestResponseDto>.Failure($"Request cannot be cancelled once its status is '{FormatCitizenStatus(request.Status)}'.");
        }

        var prev = FormatCitizenStatus(request.Status);
        request.Status = RequestStatus.Cancelled;
        request.CancellationReason = string.IsNullOrWhiteSpace(reason) ? "Cancelled by citizen" : reason.Trim();

        _context.RequestHistories.Add(new RequestHistory
        {
            RequestId = request.Id,
            FromStatus = prev,
            ToStatus = "Cancelled",
            ChangedById = citizenId,
            Notes = request.CancellationReason,
            CreatedAt = DateTime.UtcNow
        });

        var recipient = await ResolveCitizenEmailAsync(request, cancellationToken);
        var outbox = NotificationFactory.CreateStatusChangedNotification(request, "Cancelled", request.CancellationReason, recipient);
        _context.NotificationOutboxes.Add(outbox);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync(
            "AssistanceRequest",
            request.Id.ToString(),
            "Cancel",
            citizenId,
            AegisRoles.Citizen,
            new { request.TrackingNumber, reason = request.CancellationReason },
            cancellationToken);

        return Result<RequestResponseDto>.Success(MapToDto(request));
    }

    public async Task<Result<RequestResponseDto>> SubmitFeedbackAsync(
        Guid id,
        SubmitFeedbackDto dto,
        string citizenId,
        CancellationToken cancellationToken = default)
    {
        if (dto.Rating < 1 || dto.Rating > 5)
        {
            return Result<RequestResponseDto>.Failure("Rating must be between 1 and 5.");
        }

        var request = await _context.AssistanceRequests
            .Include(r => r.Histories)
            .Include(r => r.Evidence)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null)
        {
            return Result<RequestResponseDto>.Failure("Request not found.");
        }

        if (request.CitizenId != citizenId)
        {
            return Result<RequestResponseDto>.Failure("You can only leave feedback on your own assistance request.");
        }

        if (request.Status != RequestStatus.Fulfilled && request.Status != RequestStatus.Closed)
        {
            return Result<RequestResponseDto>.Failure("Feedback can only be submitted after the request is Completed.");
        }

        request.FeedbackRating = dto.Rating;
        request.FeedbackComment = dto.Comment?.Trim();
        request.FeedbackSubmittedAt = DateTime.UtcNow;

        _context.RequestHistories.Add(new RequestHistory
        {
            RequestId = request.Id,
            FromStatus = "Completed",
            ToStatus = "Completed",
            ChangedById = citizenId,
            Notes = $"Citizen feedback submitted: {dto.Rating}/5 stars. {request.FeedbackComment}",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync(
            "AssistanceRequest",
            request.Id.ToString(),
            "CitizenFeedback",
            citizenId,
            AegisRoles.Citizen,
            new { request.TrackingNumber, dto.Rating, request.FeedbackComment },
            cancellationToken);

        return Result<RequestResponseDto>.Success(MapToDto(request));
    }

    public async Task<Result<RequestResponseDto>> UpdateStatusAsync(
        Guid id,
        UpdateRequestStatusDto dto,
        string actorId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.AssistanceRequests
            .Include(r => r.Histories)
            .Include(r => r.Evidence)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null)
        {
            return Result<RequestResponseDto>.Failure("Request not found.");
        }

        var parsedStatus = ParseTargetStatus(dto.Status);
        if (parsedStatus == null)
        {
            return Result<RequestResponseDto>.Failure($"Invalid target status '{dto.Status}'.");
        }

        if (parsedStatus == RequestStatus.Rejected && string.IsNullOrWhiteSpace(dto.ReasonOrNotes))
        {
            return Result<RequestResponseDto>.Failure("A staff reason is required when rejecting a request.");
        }

        var prevLabel = FormatCitizenStatus(request.Status);
        request.Status = parsedStatus.Value;
        if (parsedStatus == RequestStatus.Rejected)
        {
            request.RejectionReason = dto.ReasonOrNotes!.Trim();
        }

        var nextLabel = FormatCitizenStatus(request.Status);
        var notes = string.IsNullOrWhiteSpace(dto.ReasonOrNotes)
            ? $"Status updated to {nextLabel} by {actorRole}."
            : dto.ReasonOrNotes.Trim();

        _context.RequestHistories.Add(new RequestHistory
        {
            RequestId = request.Id,
            FromStatus = prevLabel,
            ToStatus = nextLabel,
            ChangedById = actorId,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        });

        var recipient = await ResolveCitizenEmailAsync(request, cancellationToken);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var outbox = parsedStatus.Value switch
        {
            RequestStatus.Approved => NotificationFactory.CreateRequestApprovedNotification(request, recipient, null, suffix),
            RequestStatus.Assigned => NotificationFactory.CreateRequestAssignedNotification(request, notes, recipient, null, suffix),
            RequestStatus.Rejected => NotificationFactory.CreateRequestRejectedNotification(request, request.RejectionReason ?? notes, recipient, null, suffix),
            RequestStatus.Fulfilled or RequestStatus.Closed => NotificationFactory.CreateRequestCompletedNotification(request, recipient, null, suffix),
            _ => NotificationFactory.CreateStatusChangedNotification(request, nextLabel, notes, recipient)
        };

        _context.NotificationOutboxes.Add(outbox);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync(
            "AssistanceRequest",
            request.Id.ToString(),
            "StatusChange",
            actorId,
            actorRole,
            new { request.TrackingNumber, from = prevLabel, to = nextLabel, notes },
            cancellationToken);

        return Result<RequestResponseDto>.Success(MapToDto(request));
    }

    public async Task<IReadOnlyList<CaseItemDto>> GetCasesQueueAsync(string? sort, CancellationToken cancellationToken = default)
    {
        var query = _context.AssistanceRequests.AsNoTracking();

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
                RequestStatus.Approved => "Approved",
                RequestStatus.Assigned => "Assigned",
                RequestStatus.Dispatched => "On the way",
                RequestStatus.DuplicateCheck => "Duplicate check",
                RequestStatus.ManualTriage => "Manual triage",
                RequestStatus.Fulfilled => "Completed",
                RequestStatus.Closed => "Completed",
                RequestStatus.Rejected => "Rejected",
                RequestStatus.Cancelled => "Cancelled",
                _ => "New"
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

    private async Task<string> ResolveCitizenEmailAsync(AssistanceRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.ContactEmail))
        {
            return request.ContactEmail;
        }
        if (!string.IsNullOrWhiteSpace(request.CitizenId))
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.CitizenId, ct);
            if (!string.IsNullOrWhiteSpace(user?.Email))
            {
                return user.Email!;
            }
        }
        return request.CitizenId ?? "citizen@aegis.local";
    }

    private static bool IsCancellable(RequestStatus status)
    {
        return status is RequestStatus.Submitted
            or RequestStatus.NeedsReview
            or RequestStatus.ManualTriage
            or RequestStatus.DuplicateCheck
            or RequestStatus.Approved;
    }

    private static RequestStatus? ParseTargetStatus(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var norm = raw.Trim().ToLowerInvariant();
        return norm switch
        {
            "new" or "submitted" => RequestStatus.Submitted,
            "under review" or "needsreview" or "needs review" => RequestStatus.NeedsReview,
            "approved" => RequestStatus.Approved,
            "assigned" => RequestStatus.Assigned,
            "on the way" or "dispatched" => RequestStatus.Dispatched,
            "completed" or "fulfilled" => RequestStatus.Fulfilled,
            "rejected" => RequestStatus.Rejected,
            "cancelled" => RequestStatus.Cancelled,
            _ => Enum.TryParse<RequestStatus>(raw, true, out var st) ? st : null
        };
    }

    public static string FormatCitizenStatus(RequestStatus status)
    {
        return status switch
        {
            RequestStatus.Submitted => "New",
            RequestStatus.NeedsReview or RequestStatus.ManualTriage or RequestStatus.DuplicateCheck => "Under review",
            RequestStatus.Approved => "Approved",
            RequestStatus.Assigned => "Assigned",
            RequestStatus.Dispatched => "On the way",
            RequestStatus.Fulfilled or RequestStatus.Closed => "Completed",
            RequestStatus.Rejected => "Rejected",
            RequestStatus.Cancelled => "Cancelled",
            _ => "New"
        };
    }

    private static IReadOnlyList<RequestTimelineStepDto> BuildTimeline(AssistanceRequest r)
    {
        var stages = new[]
        {
            "New",
            "Under review",
            "Approved",
            "Assigned",
            "On the way",
            "Completed"
        };

        var currentLabel = FormatCitizenStatus(r.Status);
        var histories = (r.Histories ?? Array.Empty<RequestHistory>())
            .OrderBy(h => h.CreatedAt)
            .ToList();

        if (r.Status == RequestStatus.Rejected)
        {
            var rejHistory = histories.LastOrDefault(h => h.ToStatus.Equals("Rejected", StringComparison.OrdinalIgnoreCase));
            return
            [
                new RequestTimelineStepDto("New", "New", "New", "Request submitted by citizen.", r.CreatedAt, true, false),
                new RequestTimelineStepDto("Under review", "New", "Under review", "Reviewed by emergency coordinator.", r.CreatedAt, true, false),
                new RequestTimelineStepDto("Rejected", "Under review", "Rejected", r.RejectionReason ?? rejHistory?.Notes ?? "Rejected by staff.", rejHistory?.CreatedAt ?? r.UpdatedAt ?? r.CreatedAt, true, true)
            ];
        }

        if (r.Status == RequestStatus.Cancelled)
        {
            var cancelHistory = histories.LastOrDefault(h => h.ToStatus.Equals("Cancelled", StringComparison.OrdinalIgnoreCase));
            return
            [
                new RequestTimelineStepDto("New", "New", "New", "Request submitted by citizen.", r.CreatedAt, true, false),
                new RequestTimelineStepDto("Cancelled", "Under review", "Cancelled", r.CancellationReason ?? cancelHistory?.Notes ?? "Cancelled by citizen.", cancelHistory?.CreatedAt ?? r.UpdatedAt ?? r.CreatedAt, true, true)
            ];
        }

        var currentIndex = Array.IndexOf(stages, currentLabel);
        if (currentIndex < 0) currentIndex = 1; // Default to Under review

        var result = new List<RequestTimelineStepDto>();
        for (int i = 0; i < stages.Length; i++)
        {
            var stage = stages[i];
            var match = histories.LastOrDefault(h => h.ToStatus.Equals(stage, StringComparison.OrdinalIgnoreCase));
            var completed = i <= currentIndex;
            var current = i == currentIndex;

            var note = match?.Notes ?? stage switch
            {
                "New" => $"Reference {r.TrackingNumber} created.",
                "Under review" => "AI advisory triage scored; awaiting coordinator review.",
                "Approved" => "Approved by coordinator.",
                "Assigned" => "Field relief team and depot stock assigned.",
                "On the way" => "Relief dispatch en route to your location.",
                "Completed" => "Assistance delivered and verified.",
                _ => string.Empty
            };

            result.Add(new RequestTimelineStepDto(
                stage,
                match?.FromStatus ?? stage,
                stage,
                note,
                match?.CreatedAt ?? r.CreatedAt,
                completed,
                current
            ));
        }

        return result;
    }

    public async Task<Result<bool>> KeepSeparateDuplicateAsync(
        Guid requestId,
        Guid candidateId,
        string notes,
        string actorId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var primary = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken);
        var candidate = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == candidateId, cancellationToken);

        if (primary == null || candidate == null)
        {
            return Result<bool>.Failure("One or both requests not found.");
        }

        _context.RequestHistories.Add(new RequestHistory
        {
            RequestId = primary.Id,
            FromStatus = "DuplicateReview",
            ToStatus = primary.Status.ToString(),
            ChangedById = actorId,
            Notes = $"Confirmed distinct from candidate #{candidate.TrackingNumber}: {notes}",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync(
            "AssistanceRequest",
            primary.Id.ToString(),
            "KeepSeparate",
            actorId,
            actorRole,
            new { candidateTracking = candidate.TrackingNumber, notes },
            cancellationToken
        );

        return Result<bool>.Success(true);
    }

    public async Task<IReadOnlyList<RequestChatMessageDto>> GetMessagesAsync(
        string idOrTracking,
        string? currentUserId,
        string currentUserRole,
        CancellationToken cancellationToken = default)
    {
        AssistanceRequest? request;
        if (Guid.TryParse(idOrTracking, out var guid))
        {
            request = await _context.AssistanceRequests.Include(r => r.Histories).FirstOrDefaultAsync(r => r.Id == guid, cancellationToken);
        }
        else
        {
            var norm = idOrTracking.Trim().ToUpperInvariant();
            request = await _context.AssistanceRequests.Include(r => r.Histories).FirstOrDefaultAsync(r => r.TrackingNumber.ToUpper() == norm, cancellationToken);
        }

        if (request == null) return Array.Empty<RequestChatMessageDto>();

        if (currentUserRole == AegisRoles.Citizen && request.CitizenId != currentUserId)
        {
            throw new UnauthorizedAccessException("Citizens can only access their own request chat.");
        }

        var messages = request.Histories
            .Where(h => h.FromStatus == "Chat" || h.ChangedById == "System")
            .OrderBy(h => h.CreatedAt)
            .Select(h =>
            {
                var isSystem = h.ChangedById.Equals("System", StringComparison.OrdinalIgnoreCase);
                var isStaff = !isSystem && (h.ChangedById != request.CitizenId);
                var role = isSystem ? "System" : (isStaff ? "Staff" : "Citizen");
                var name = isSystem ? "AEGIS System" : (isStaff ? "Emergency Coordinator" : "Citizen");
                return new RequestChatMessageDto(h.Id, request.Id, role, name, h.Notes, h.CreatedAt, isSystem);
            })
            .ToList();

        return messages;
    }

    public async Task<Result<RequestChatMessageDto>> SendMessageAsync(
        string idOrTracking,
        string messageText,
        string senderId,
        string senderRole,
        string senderName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(messageText))
        {
            return Result<RequestChatMessageDto>.Failure("Message text cannot be empty.");
        }

        AssistanceRequest? request;
        if (Guid.TryParse(idOrTracking, out var guid))
        {
            request = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == guid, cancellationToken);
        }
        else
        {
            var norm = idOrTracking.Trim().ToUpperInvariant();
            request = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.TrackingNumber.ToUpper() == norm, cancellationToken);
        }

        if (request == null) return Result<RequestChatMessageDto>.Failure("Request not found.");

        if (senderRole == AegisRoles.Citizen && request.CitizenId != senderId)
        {
            return Result<RequestChatMessageDto>.Failure("Citizens can only send messages on their own assistance requests.");
        }

        var history = new RequestHistory
        {
            RequestId = request.Id,
            FromStatus = "Chat",
            ToStatus = "Chat",
            ChangedById = senderId,
            Notes = messageText.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.RequestHistories.Add(history);
        await _context.SaveChangesAsync(cancellationToken);

        var isStaff = senderRole != AegisRoles.Citizen;
        var dto = new RequestChatMessageDto(
            history.Id,
            request.Id,
            isStaff ? "Staff" : "Citizen",
            string.IsNullOrWhiteSpace(senderName) ? (isStaff ? "Coordinator" : "Citizen") : senderName,
            history.Notes,
            history.CreatedAt,
            false
        );

        return Result<RequestChatMessageDto>.Success(dto);
    }

    private static string TranslateToEnglish(string text, string language, string category)
    {
        if (string.IsNullOrWhiteSpace(text) || language.Equals("en", StringComparison.OrdinalIgnoreCase))
        {
            return text;
        }

        var translations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["වතුර අවශ්‍යයි"] = "Clean drinking water needed urgently",
            ["බෙහෙත් ඕන"] = "Medicine needed urgently",
            ["අසාධ්‍ය"] = "Critical patient needing immediate care",
            ["හිරවෙලා"] = "Trapped in flood waters",
            ["දරුවා"] = "Infant / young child affected",
            ["වැඩිහිටි"] = "Elderly person needs support",
            ["ආහාර නැත"] = "No food available",
            ["ලේ ගලනවා"] = "Bleeding heavily, urgent first aid needed",
            ["மருந்து"] = "Medicine required urgently",
            ["இன்சுலின்"] = "Insulin required immediately",
            ["குழந்தை"] = "Infant in household",
            ["சிக்கியுள்ளனர்"] = "Trapped residents needing rescue",
            ["முதியவர்"] = "Elderly citizen needing assistance",
            ["உயிராபத்து"] = "Life-threatening emergency",
            ["நீர்"] = "Clean drinking water urgently needed",
            ["தண்ணீர்"] = "Drinking water shortage",
            ["உணவு"] = "Food rations required"
        };

        var translated = text;
        foreach (var (k, v) in translations)
        {
            if (translated.Contains(k))
            {
                translated = translated.Replace(k, $"[{v}]");
            }
        }

        if (translated == text)
        {
            return $"[English Translation ({language.ToUpper()})]: Emergency assistance requested for {category}. Citizen reports: {text}";
        }

        return $"[English Translation]: {translated}";
    }

    private static RequestResponseDto MapToDto(AssistanceRequest r, string? maskedNic = null)
    {
        var timeline = BuildTimeline(r);
        var evidence = (r.Evidence ?? Array.Empty<RequestEvidence>())
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new RequestEvidenceItemDto(
                e.Id,
                e.FileName,
                e.ContentType,
                e.FileSizeBytes,
                e.Sha256Hash,
                e.CreatedAt))
            .ToList();

        var canCancel = IsCancellable(r.Status);
        var canSubmitFeedback = (r.Status == RequestStatus.Fulfilled || r.Status == RequestStatus.Closed) && !r.FeedbackRating.HasValue;

        var latestRec = r.Recommendations?.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
        var aiPriority = latestRec != null ? latestRec.Priority.ToString() : r.Priority.ToString();
        var aiConfidence = latestRec != null ? latestRec.Confidence : Math.Round(r.UrgencyScore / 100.0, 2);
        var recommendationId = latestRec?.Id;
        var englishTranslation = TranslateToEnglish(r.Description, r.Language, r.Category);

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
            r.CreatedAt,
            r.VulnerableFlags,
            r.ContactMobile,
            r.ContactEmail,
            r.RejectionReason,
            r.CancellationReason,
            r.FeedbackRating,
            r.FeedbackComment,
            r.FeedbackSubmittedAt,
            canCancel,
            canSubmitFeedback,
            timeline,
            evidence,
            aiPriority,
            aiConfidence,
            maskedNic,
            englishTranslation,
            recommendationId
        );
    }
}

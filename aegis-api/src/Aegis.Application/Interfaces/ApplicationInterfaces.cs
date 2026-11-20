using Aegis.Application.DTOs;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;

namespace Aegis.Application.Interfaces;

public record AiScoringResult(
    RequestPriority Priority,
    double Confidence,
    string RationaleJson,
    string FeatureScoresJson,
    string ModelName,
    string ModelVersion
);

public interface IAiProvider
{
    Task<AiScoringResult> ScoreUrgencyAsync(AssistanceRequest request, CancellationToken cancellationToken = default);
    Task<bool> DetectDuplicatesAsync(AssistanceRequest request, AssistanceRequest candidate, CancellationToken cancellationToken = default);
    Task<bool> DetectAnomalyAsync(Donation donation, CancellationToken cancellationToken = default);
}

public interface INicCryptoService
{
    string NormalizeNic(string rawNic);
    string EncryptNic(string plainNic);
    string DecryptNic(string cipherTextBase64);
    string ComputeNicHmac(string plainNic);
    string MaskNic(string plainNic);
}

public interface IEmailSender
{
    Task<bool> SendEmailAsync(string toEmail, string subject, string plainTextBody, string htmlBody, CancellationToken cancellationToken = default);
}

public interface ISmsSender
{
    Task<bool> SendSmsAsync(string toPhoneNumber, string message, CancellationToken cancellationToken = default);
}

public interface IAuthService
{
    Task<Result<RegisterCitizenResponseDto>> RegisterCitizenAsync(RegisterCitizenRequestDto dto, CancellationToken cancellationToken = default);
    Task<Result<AuthResponseDto>> VerifyEmailOtpAsync(VerifyEmailOtpDto dto, CancellationToken cancellationToken = default);
    Task<Result<int>> ResendOtpAsync(ResendOtpRequestDto dto, CancellationToken cancellationToken = default);
    Task<Result<int>> ForgotPasswordAsync(ForgotPasswordRequestDto dto, CancellationToken cancellationToken = default);
    Task<Result<bool>> ResetPasswordAsync(ResetPasswordRequestDto dto, CancellationToken cancellationToken = default);
    Task<Result<AuthResponseDto>> LoginCitizenAsync(LoginRequestDto dto, CancellationToken cancellationToken = default);
    Task<Result<AuthResponseDto>> LoginStaffAsync(StaffLoginRequestDto dto, CancellationToken cancellationToken = default);
    Task<AuthResponseDto?> RefreshTokenAsync(RefreshTokenRequestDto dto, CancellationToken cancellationToken = default);
    Task<bool> RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default);

    // Staff Management (SystemAdmin)
    Task<Result<string>> InviteStaffAsync(InviteStaffRequestDto dto, string adminUserId, string frontendOrigin, CancellationToken cancellationToken = default);
    Task<Result<AuthResponseDto>> AcceptStaffInviteAsync(AcceptStaffInviteRequestDto dto, CancellationToken cancellationToken = default);
    Task<Result<bool>> SetStaffEnabledAsync(string targetUserId, bool isEnabled, string adminUserId, CancellationToken cancellationToken = default);
    Task<Result<bool>> ChangeStaffRoleAsync(string targetUserId, ChangeStaffRoleDto dto, string adminUserId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffMemberDto>> GetStaffMembersAsync(CancellationToken cancellationToken = default);
}

public interface IRequestService
{
    Task<DuplicateWarningDto?> CheckCitizenDuplicateAsync(CreateRequestDto dto, string? citizenId, CancellationToken cancellationToken = default);
    Task<RequestResponseDto> CreateRequestAsync(CreateRequestDto dto, string? citizenId, string? idempotencyKey, CancellationToken cancellationToken = default);
    Task<RequestResponseDto?> GetByIdAsync(Guid id, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<RequestResponseDto?> GetByIdOrTrackingAsync(string idOrTracking, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RequestResponseDto>> GetAllAsync(string? status, string? priority, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<PagedRequestsDto> GetPagedAsync(string? search, string? status, string? priority, string? district, string? language, int page, int pageSize, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CaseItemDto>> GetCasesQueueAsync(string? sort, CancellationToken cancellationToken = default);
    Task<CitizenContactProfileDto?> GetCitizenProfileAsync(string userId, CancellationToken cancellationToken = default);
    Task<Result<RequestResponseDto>> CancelRequestAsync(Guid id, string? reason, string citizenId, CancellationToken cancellationToken = default);
    Task<Result<RequestResponseDto>> SubmitFeedbackAsync(Guid id, SubmitFeedbackDto dto, string citizenId, CancellationToken cancellationToken = default);
    Task<Result<RequestResponseDto>> UpdateStatusAsync(Guid id, UpdateRequestStatusDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default);
    Task<Result<bool>> KeepSeparateDuplicateAsync(Guid requestId, Guid candidateId, string notes, string actorId, string actorRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RequestChatMessageDto>> GetMessagesAsync(string idOrTracking, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<Result<RequestChatMessageDto>> SendMessageAsync(string idOrTracking, string messageText, string senderId, string senderRole, string senderName, CancellationToken cancellationToken = default, bool usedAiDraft = false);
}

public interface IDecisionService
{
    Task<DecisionResponseDto> RecordDecisionAsync(Guid recommendationId, DecisionRequestDto dto, string decidedById, string decidedByRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiRecommendationDto>> GetPendingRecommendationsAsync(CancellationToken cancellationToken = default);
    Task<AiRecommendationDto?> GetLatestForRequestAsync(Guid requestId, CancellationToken cancellationToken = default);
}

public record NluExtractedFields(
    string NeedType,
    int? PeopleCount,
    IReadOnlyList<string> LocationHints,
    IReadOnlyList<string> MedicalTerms
);

public record NluNormalizationResult(
    string DetectedLanguage,
    string NormalizedText,
    string EnglishText,
    NluExtractedFields Extracted,
    double Confidence,
    string Provider,
    string PromptVersion,
    bool UsedFallback
);

public interface IMultilingualNluService
{
    Task<NluNormalizationResult> NormalizeAsync(string rawText, string? declaredLanguage = null, CancellationToken cancellationToken = default);
}

public interface IAiGovernanceService
{
    Task<AiGovernanceConfig> GetCurrentConfigAsync(CancellationToken cancellationToken = default);
    Task<AiGovernanceViewDto> GetGovernanceViewAsync(CancellationToken cancellationToken = default);
    Task<Result<AiGovernanceConfigDto>> UpdateGovernanceAsync(UpdateAiGovernanceDto dto, string adminUserId, CancellationToken cancellationToken = default);
    Task<AiAnalyticsDto> GetAnalyticsAsync(DateTime? from, DateTime? to, CancellationToken cancellationToken = default);
}

public interface IKpiService
{
    Task<IReadOnlyList<KpiDto>> GetDashboardKpisAsync(CancellationToken cancellationToken = default);
}

public record DistressResult(
    string DistressLevel, // none | elevated | high
    string Reason,
    double Confidence,
    bool RuleMatched,
    string PromptVersion
);

public interface IDistressDetectionService
{
    Task<DistressResult> AnalyzeAsync(string messageText, string? language = null, CancellationToken cancellationToken = default);
}

public interface IRealtimeSignalPublisher
{
    Task PublishAsync(string eventType, object payload, CancellationToken cancellationToken = default);
}

public interface IAiCopilotService
{
    Task<ChatSummaryDto> SummarizeChatAsync(Guid requestId, string staffUserId, CancellationToken cancellationToken = default);
    Task<SuggestedReplyDto> SuggestReplyAsync(Guid requestId, string staffUserId, CancellationToken cancellationToken = default);
    Task<HandoverNoteDto> GenerateHandoverAsync(string staffUserId, DateTime sinceUtc, CancellationToken cancellationToken = default);
    Task<NlSearchResponseDto> NaturalLanguageSearchAsync(string query, string staffUserId, CancellationToken cancellationToken = default);
    Task<SituationReportDraftDto> GenerateDailySituationDraftAsync(string staffUserId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SituationReportDraftDto>> ListSituationDraftsAsync(CancellationToken cancellationToken = default);
    Task<Result<SituationReportDraftDto>> UpdateSituationDraftAsync(Guid draftId, UpdateSituationReportDraftDto dto, string staffUserId, CancellationToken cancellationToken = default);
    Task<Result<SituationReportDraftDto>> PublishSituationDraftAsync(Guid draftId, string staffUserId, CancellationToken cancellationToken = default);
}

public interface IPredictionService
{
    Task<IReadOnlyList<StockForecastDto>> GetStockForecastsAsync(CancellationToken cancellationToken = default);
    Task<DistrictRiskResponseDto> GetDistrictRiskAsync(CancellationToken cancellationToken = default);
    Task<DistrictRiskResponseDto> RefreshDistrictRiskAsync(CancellationToken cancellationToken = default);
}

public interface IDispatchOptimiser
{
    string StrategyName { get; }
    Task<Result<DispatchPlanDto>> OptimizeAsync(DispatchPlanRequestDto input, string createdById, CancellationToken cancellationToken = default);
}

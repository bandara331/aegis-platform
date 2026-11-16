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
    Task<RequestResponseDto> CreateRequestAsync(CreateRequestDto dto, string? citizenId, string? idempotencyKey, CancellationToken cancellationToken = default);
    Task<RequestResponseDto?> GetByIdAsync(Guid id, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RequestResponseDto>> GetAllAsync(string? status, string? priority, string? currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CaseItemDto>> GetCasesQueueAsync(string? sort, CancellationToken cancellationToken = default);
}

public interface IDecisionService
{
    Task<DecisionResponseDto> RecordDecisionAsync(Guid recommendationId, DecisionRequestDto dto, string decidedById, string decidedByRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiRecommendationDto>> GetPendingRecommendationsAsync(CancellationToken cancellationToken = default);
}

public interface IKpiService
{
    Task<IReadOnlyList<KpiDto>> GetDashboardKpisAsync(CancellationToken cancellationToken = default);
}

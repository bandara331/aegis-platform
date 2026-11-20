namespace Aegis.Application.DTOs;

public record LoginRequestDto(string Email, string Password);

public record StaffLoginRequestDto(string Email, string Password, string? Otp = null);

public record RegisterCitizenRequestDto(
    string FullName,
    string Nic,
    string Mobile,
    string Email,
    string Password,
    string Language,
    bool ConsentGiven = true,
    bool AlertOptIn = false,
    string? District = null
);

public record RegisterCitizenResponseDto(
    string UserId,
    string Email,
    string MaskedNic,
    bool RequiresEmailVerification,
    int ResendCooldownSeconds,
    string Message
);

public record VerifyEmailOtpDto(string Email, string Otp);

public record ResendOtpRequestDto(string Email, string Purpose = "VerifyEmail");

public record ForgotPasswordRequestDto(string Email);

public record ResetPasswordRequestDto(string Email, string Otp, string NewPassword);

public record RefreshTokenRequestDto(string RefreshToken);

public record AuthResponseDto(
    string AccessToken,
    string RefreshToken,
    int ExpiresInSeconds,
    string UserId,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles,
    string? MaskedNic = null,
    bool RequiresOtp = false
);

// Staff Management DTOs (SystemAdmin)
public record InviteStaffRequestDto(
    string Email,
    string FullName,
    string Role,
    string Language = "en"
);

public record AcceptStaffInviteRequestDto(
    string Email,
    string Token,
    string Password
);

public record UpdateStaffStatusDto(bool IsEnabled);

public record ChangeStaffRoleDto(
    string NewRole,
    string SecondApproverId,
    string Justification
);

public record StaffMemberDto(
    string UserId,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles,
    bool IsEnabled,
    bool EmailConfirmed,
    DateTime CreatedAt
);

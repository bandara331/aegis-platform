using System.Security.Claims;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Enums;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Aegis.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IValidator<LoginRequestDto> _loginValidator;
    private readonly IValidator<StaffLoginRequestDto> _staffLoginValidator;
    private readonly IValidator<RegisterCitizenRequestDto> _registerValidator;
    private readonly IValidator<VerifyEmailOtpDto> _verifyOtpValidator;
    private readonly IValidator<ResetPasswordRequestDto> _resetPasswordValidator;

    public AuthController(
        IAuthService auth,
        IValidator<LoginRequestDto> loginValidator,
        IValidator<StaffLoginRequestDto> staffLoginValidator,
        IValidator<RegisterCitizenRequestDto> registerValidator,
        IValidator<VerifyEmailOtpDto> verifyOtpValidator,
        IValidator<ResetPasswordRequestDto> resetPasswordValidator)
    {
        _auth = auth;
        _loginValidator = loginValidator;
        _staffLoginValidator = staffLoginValidator;
        _registerValidator = registerValidator;
        _verifyOtpValidator = verifyOtpValidator;
        _resetPasswordValidator = resetPasswordValidator;
    }

    /// <summary>Minimal citizen registration with AES-256-GCM NIC encryption, HMAC uniqueness, and 6-digit email OTP.</summary>
    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterCitizenRequestDto dto, CancellationToken ct)
    {
        var validation = await _registerValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid) return ValidationProblem(ToModelState(validation));

        var result = await _auth.RegisterCitizenAsync(dto, ct);
        return result.IsFailure
            ? Conflict(new ProblemDetails { Status = 409, Title = "Registration failed", Detail = result.Error })
            : StatusCode(StatusCodes.Status201Created, result.Value);
    }

    /// <summary>Verify 6-digit email OTP (10-min expiry, max 5 attempts) before first citizen login.</summary>
    [HttpPost("verify-email")]
    [EnableRateLimiting("otp")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailOtpDto dto, CancellationToken ct)
    {
        var validation = await _verifyOtpValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid) return ValidationProblem(ToModelState(validation));

        var result = await _auth.VerifyEmailOtpAsync(dto, ct);
        return result.IsFailure
            ? BadRequest(new ProblemDetails { Status = 400, Title = "Email verification failed", Detail = result.Error })
            : Ok(result.Value);
    }

    /// <summary>Resend 6-digit OTP with 60-second cooldown enforcement.</summary>
    [HttpPost("resend-otp")]
    [EnableRateLimiting("otp")]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequestDto dto, CancellationToken ct)
    {
        var result = await _auth.ResendOtpAsync(dto, ct);
        return result.IsFailure
            ? StatusCode(StatusCodes.Status429TooManyRequests, new ProblemDetails { Status = 429, Title = "Cooldown active", Detail = result.Error })
            : Ok(new { resendCooldownSeconds = result.Value, message = "Verification code queued." });
    }

    /// <summary>Request a 6-digit password reset OTP via email.</summary>
    [HttpPost("forgot-password")]
    [EnableRateLimiting("otp")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto dto, CancellationToken ct)
    {
        var result = await _auth.ForgotPasswordAsync(dto, ct);
        return result.IsFailure
            ? StatusCode(StatusCodes.Status429TooManyRequests, new ProblemDetails { Status = 429, Title = "Cooldown active", Detail = result.Error })
            : Ok(new { resendCooldownSeconds = result.Value, message = "If the account exists, a 6-digit reset code has been sent." });
    }

    /// <summary>Reset password using the 6-digit email OTP.</summary>
    [HttpPost("reset-password")]
    [EnableRateLimiting("otp")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequestDto dto, CancellationToken ct)
    {
        var validation = await _resetPasswordValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid) return ValidationProblem(ToModelState(validation));

        var result = await _auth.ResetPasswordAsync(dto, ct);
        return result.IsFailure
            ? BadRequest(new ProblemDetails { Status = 400, Title = "Password reset failed", Detail = result.Error })
            : Ok(new { message = "Password updated. You can now sign in." });
    }

    /// <summary>Citizen-only login. Requires verified email.</summary>
    [HttpPost("login")]
    [EnableRateLimiting("citizen-login")]
    public async Task<IActionResult> LoginCitizen([FromBody] LoginRequestDto dto, CancellationToken ct)
    {
        var validation = await _loginValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid) return ValidationProblem(ToModelState(validation));

        var result = await _auth.LoginCitizenAsync(dto, ct);
        if (result.IsFailure)
        {
            if (result.Error.StartsWith("EMAIL_NOT_VERIFIED", StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails { Status = 403, Title = "EMAIL_NOT_VERIFIED", Detail = result.Error });
            }
            if (result.Error.StartsWith("STAFF_PORTAL_REQUIRED", StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails { Status = 403, Title = "STAFF_PORTAL_REQUIRED", Detail = result.Error });
            }
            return Unauthorized(new ProblemDetails { Status = 401, Title = "Sign-in failed", Detail = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>Staff-only login (supports optional 2nd-step email OTP via Security:StaffLoginOtp).</summary>
    [HttpPost("staff/login")]
    [EnableRateLimiting("staff-login")]
    public async Task<IActionResult> LoginStaff([FromBody] StaffLoginRequestDto dto, CancellationToken ct)
    {
        var validation = await _staffLoginValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid) return ValidationProblem(ToModelState(validation));

        var result = await _auth.LoginStaffAsync(dto, ct);
        if (result.IsFailure)
        {
            if (result.Error.StartsWith("CITIZEN_PORTAL_REQUIRED", StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails { Status = 403, Title = "CITIZEN_PORTAL_REQUIRED", Detail = result.Error });
            }
            return Unauthorized(new ProblemDetails { Status = 401, Title = "Staff sign-in failed", Detail = result.Error });
        }

        if (result.Value!.RequiresOtp)
        {
            return Accepted(result.Value);
        }

        return Ok(result.Value);
    }

    /// <summary>Accept one-time 24h staff invitation token and set password.</summary>
    [HttpPost("accept-invite")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> AcceptInvite([FromBody] AcceptStaffInviteRequestDto dto, CancellationToken ct)
    {
        var result = await _auth.AcceptStaffInviteAsync(dto, ct);
        return result.IsFailure
            ? BadRequest(new ProblemDetails { Status = 400, Title = "Invitation invalid", Detail = result.Error })
            : Ok(result.Value);
    }

    [HttpPost("refresh")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequestDto dto, CancellationToken ct)
    {
        var result = await _auth.RefreshTokenAsync(dto, ct);
        return result == null
            ? Unauthorized(new ProblemDetails { Status = 401, Title = "Invalid or expired refresh token" })
            : Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequestDto dto, CancellationToken ct)
    {
        await _auth.RevokeRefreshTokenAsync(dto.RefreshToken, ct);
        return NoContent();
    }

    private static Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary ToModelState(FluentValidation.Results.ValidationResult v)
    {
        var ms = new Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary();
        foreach (var e in v.Errors) ms.AddModelError(e.PropertyName, e.ErrorMessage);
        return ms;
    }
}

[ApiController]
[Route("api/v1/admin/staff")]
[Authorize(Policy = "StaffOnly")]
public class StaffManagementController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IValidator<InviteStaffRequestDto> _inviteValidator;
    private readonly IConfiguration _config;

    public StaffManagementController(
        IAuthService auth,
        IValidator<InviteStaffRequestDto> inviteValidator,
        IConfiguration config)
    {
        _auth = auth;
        _inviteValidator = inviteValidator;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _auth.GetStaffMembersAsync(ct));

    [HttpPost("invite")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Invite([FromBody] InviteStaffRequestDto dto, CancellationToken ct)
    {
        var validation = await _inviteValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var ms = new Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary();
            foreach (var e in validation.Errors) ms.AddModelError(e.PropertyName, e.ErrorMessage);
            return ValidationProblem(ms);
        }

        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "admin";
        var frontendOrigin = _config["Cors:FrontendOrigin"] ?? "http://localhost:3000";
        var result = await _auth.InviteStaffAsync(dto, adminId, frontendOrigin, ct);

        return result.IsFailure
            ? BadRequest(new ProblemDetails { Status = 400, Title = "Invitation failed", Detail = result.Error })
            : StatusCode(StatusCodes.Status201Created, new { invitationId = result.Value, email = dto.Email, role = dto.Role });
    }

    [HttpPatch("{userId}/status")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetStatus(string userId, [FromBody] UpdateStaffStatusDto dto, CancellationToken ct)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "admin";
        var result = await _auth.SetStaffEnabledAsync(userId, dto.IsEnabled, adminId, ct);
        return result.IsFailure
            ? BadRequest(new ProblemDetails { Status = 400, Title = "Status update failed", Detail = result.Error })
            : Ok(new { userId, isEnabled = dto.IsEnabled });
    }

    [HttpPost("{userId}/role")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ChangeRole(string userId, [FromBody] ChangeStaffRoleDto dto, CancellationToken ct)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "admin";
        var result = await _auth.ChangeStaffRoleAsync(userId, dto, adminId, ct);
        return result.IsFailure
            ? BadRequest(new ProblemDetails { Status = 400, Title = "Role change rejected", Detail = result.Error })
            : Ok(new { userId, newRole = dto.NewRole });
    }
}

[ApiController]
[Route("api/v1/requests")]
[Authorize]
public class RequestsController : ControllerBase
{
    private readonly IRequestService _requests;
    private readonly IValidator<CreateRequestDto> _validator;

    public RequestsController(IRequestService requests, IValidator<CreateRequestDto> validator)
    {
        _requests = requests;
        _validator = validator;
    }

    [HttpPost]
    [EnableRateLimiting("requests")]
    public async Task<IActionResult> Create(
        [FromBody] CreateRequestDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var ms = new Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary();
            foreach (var e in validation.Errors) ms.AddModelError(e.PropertyName, e.ErrorMessage);
            return ValidationProblem(ms);
        }

        var created = await _requests.CreateRequestAsync(dto, UserId, idempotencyKey, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? priority, CancellationToken ct)
        => Ok(await _requests.GetAllAsync(status, priority, UserId, PrimaryRole, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _requests.GetByIdAsync(id, UserId, PrimaryRole, ct);
        return result == null ? NotFound() : Ok(result);
    }

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    private string PrimaryRole => User.IsInRole(AegisRoles.Citizen) && User.FindAll(ClaimTypes.Role).Count() == 1
        ? AegisRoles.Citizen
        : User.FindFirstValue(ClaimTypes.Role) ?? AegisRoles.Citizen;
}

[ApiController]
[Route("api/v1/cases")]
[Authorize(Policy = "StaffOnly")]
public class CasesController : ControllerBase
{
    private readonly IRequestService _requests;
    public CasesController(IRequestService requests) => _requests = requests;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? sort, CancellationToken ct)
        => Ok(await _requests.GetCasesQueueAsync(sort ?? "ai_priority", ct));
}

[ApiController]
[Route("api/v1/metrics")]
[Authorize(Policy = "StaffOnly")]
public class MetricsController : ControllerBase
{
    private readonly IKpiService _kpis;
    public MetricsController(IKpiService kpis) => _kpis = kpis;

    [HttpGet("kpis")]
    public async Task<IActionResult> Kpis(CancellationToken ct) => Ok(await _kpis.GetDashboardKpisAsync(ct));
}

[ApiController]
[Route("api/v1/ai")]
[Authorize(Policy = "StaffOnly")]
public class AiController : ControllerBase
{
    private readonly IDecisionService _decisions;
    private readonly IValidator<DecisionRequestDto> _validator;

    public AiController(IDecisionService decisions, IValidator<DecisionRequestDto> validator)
    {
        _decisions = decisions;
        _validator = validator;
    }

    [HttpGet("recommendations")]
    public async Task<IActionResult> Pending(CancellationToken ct) => Ok(await _decisions.GetPendingRecommendationsAsync(ct));

    [HttpPost("recommendations/{id:guid}/decision")]
    [Authorize(Policy = "CanDecide")]
    public async Task<IActionResult> Decide(Guid id, [FromBody] DecisionRequestDto dto, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var ms = new Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary();
            foreach (var e in validation.Errors) ms.AddModelError(e.PropertyName, e.ErrorMessage);
            return ValidationProblem(ms);
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? "unknown";
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "Staff";
        return Ok(await _decisions.RecordDecisionAsync(id, dto, userId, role, ct));
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Identity;
using Aegis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Aegis.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AegisDbContext _context;
    private readonly INicCryptoService _nicCrypto;
    private readonly IAuditService _auditService;
    private readonly IConfiguration _configuration;

    public const int OtpExpiryMinutes = 10;
    public const int OtpMaxAttempts = 5;
    public const int OtpResendCooldownSeconds = 60;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        AegisDbContext context,
        INicCryptoService nicCrypto,
        IAuditService auditService,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _context = context;
        _nicCrypto = nicCrypto;
        _auditService = auditService;
        _configuration = configuration;
    }

    public async Task<Result<RegisterCitizenResponseDto>> RegisterCitizenAsync(
        RegisterCitizenRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        if (await _userManager.FindByEmailAsync(normalizedEmail) != null)
        {
            return Result<RegisterCitizenResponseDto>.Failure("An account with this email address is already registered.");
        }

        var nicHmac = _nicCrypto.ComputeNicHmac(dto.Nic);
        if (await _context.Users.AnyAsync(u => u.NicHmac == nicHmac, cancellationToken))
        {
            return Result<RegisterCitizenResponseDto>.Failure("An account with this NIC is already registered.");
        }

        var encryptedNic = _nicCrypto.EncryptNic(dto.Nic);
        var maskedNic = _nicCrypto.MaskNic(dto.Nic);

        var user = new ApplicationUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FullName = dto.FullName.Trim(),
            PhoneNumber = dto.Mobile.Trim(),
            PreferredLanguage = dto.Language ?? "en",
            NicCiphertext = encryptedNic,
            NicHmac = nicHmac,
            MaskedNic = maskedNic,
            PersonalDataConsent = dto.ConsentGiven,
            ConsentGivenAtUtc = DateTime.UtcNow,
            EmailConfirmed = false, // Must verify 6-digit email OTP before first login
            IsEnabled = true
        };

        var createResult = await _userManager.CreateAsync(user, dto.Password);
        if (!createResult.Succeeded)
        {
            var err = string.Join("; ", createResult.Errors.Select(e => e.Description));
            return Result<RegisterCitizenResponseDto>.Failure(err);
        }

        await _userManager.AddToRoleAsync(user, AegisRoles.Citizen);

        // Issue 6-digit Email Verification OTP (stored hashed, never logged)
        await CreateAndQueueOtpChallengeAsync(normalizedEmail, "VerifyEmail", user.PreferredLanguage, cancellationToken);

        await _auditService.AppendAsync(
            "User",
            user.Id,
            "RegisterCitizen",
            user.Id,
            AegisRoles.Citizen,
            new { maskedNic, language = user.PreferredLanguage, consentGiven = true },
            cancellationToken);

        return Result<RegisterCitizenResponseDto>.Success(new RegisterCitizenResponseDto(
            user.Id,
            normalizedEmail,
            maskedNic,
            RequiresEmailVerification: true,
            ResendCooldownSeconds: OtpResendCooldownSeconds,
            Message: "Registration created. Please enter the 6-digit verification code sent to your email."
        ));
    }

    public async Task<Result<AuthResponseDto>> VerifyEmailOtpAsync(
        VerifyEmailOtpDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null)
        {
            return Result<AuthResponseDto>.Failure("Invalid verification request.");
        }

        var verifyResult = await ValidateAndConsumeOtpAsync(normalizedEmail, "VerifyEmail", dto.Otp.Trim(), cancellationToken);
        if (verifyResult.IsFailure)
        {
            return Result<AuthResponseDto>.Failure(verifyResult.Error);
        }

        user.EmailConfirmed = true;
        await _userManager.UpdateAsync(user);

        // Queue localized Welcome Email in Outbox
        var welcomeOutbox = NotificationFactory.CreateWelcomeEmail(normalizedEmail, user.FullName, user.PreferredLanguage, user.Id);
        if (!await _context.NotificationOutboxes.AnyAsync(n => n.IdempotencyKey == welcomeOutbox.IdempotencyKey, cancellationToken))
        {
            _context.NotificationOutboxes.Add(welcomeOutbox);
            await _context.SaveChangesAsync(cancellationToken);
        }

        await _auditService.AppendAsync("User", user.Id, "VerifyEmail", user.Id, AegisRoles.Citizen,
            new { emailVerified = true }, cancellationToken);

        var roles = await _userManager.GetRolesAsync(user);
        var auth = await GenerateAuthResponseAsync(user, roles, cancellationToken);
        return Result<AuthResponseDto>.Success(auth);
    }

    public async Task<Result<int>> ResendOtpAsync(
        ResendOtpRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null)
        {
            return Result<int>.Success(OtpResendCooldownSeconds);
        }

        var purpose = string.IsNullOrWhiteSpace(dto.Purpose) ? "VerifyEmail" : dto.Purpose.Trim();
        var latest = await _context.EmailOtpChallenges
            .Where(c => c.Email == normalizedEmail && c.Purpose == purpose && c.ConsumedAtUtc == null)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (latest != null && latest.ResendAvailableAtUtc > DateTime.UtcNow)
        {
            var waitSeconds = Math.Max(1, (int)Math.Ceiling((latest.ResendAvailableAtUtc - DateTime.UtcNow).TotalSeconds));
            return Result<int>.Failure($"Please wait {waitSeconds} seconds before requesting another OTP.");
        }

        await CreateAndQueueOtpChallengeAsync(normalizedEmail, purpose, user.PreferredLanguage, cancellationToken);
        return Result<int>.Success(OtpResendCooldownSeconds);
    }

    public async Task<Result<int>> ForgotPasswordAsync(
        ForgotPasswordRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null || !user.IsEnabled)
        {
            // Return success cooldown without leaking account existence
            return Result<int>.Success(OtpResendCooldownSeconds);
        }

        var latest = await _context.EmailOtpChallenges
            .Where(c => c.Email == normalizedEmail && c.Purpose == "PasswordReset" && c.ConsumedAtUtc == null)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (latest != null && latest.ResendAvailableAtUtc > DateTime.UtcNow)
        {
            var waitSeconds = Math.Max(1, (int)Math.Ceiling((latest.ResendAvailableAtUtc - DateTime.UtcNow).TotalSeconds));
            return Result<int>.Failure($"Please wait {waitSeconds} seconds before requesting another password reset code.");
        }

        await CreateAndQueueOtpChallengeAsync(normalizedEmail, "PasswordReset", user.PreferredLanguage, cancellationToken);
        return Result<int>.Success(OtpResendCooldownSeconds);
    }

    public async Task<Result<bool>> ResetPasswordAsync(
        ResetPasswordRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null || !user.IsEnabled)
        {
            return Result<bool>.Failure("Invalid password reset request.");
        }

        var otpCheck = await ValidateAndConsumeOtpAsync(normalizedEmail, "PasswordReset", dto.Otp.Trim(), cancellationToken);
        if (otpCheck.IsFailure)
        {
            return Result<bool>.Failure(otpCheck.Error);
        }

        var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
        var resetResult = await _userManager.ResetPasswordAsync(user, resetToken, dto.NewPassword);
        if (!resetResult.Succeeded)
        {
            var err = string.Join("; ", resetResult.Errors.Select(e => e.Description));
            return Result<bool>.Failure(err);
        }

        // Revoke all existing refresh tokens for this user
        var activeTokens = await _context.RefreshTokens
            .Where(t => t.UserId == user.Id && !t.IsRevoked)
            .ToListAsync(cancellationToken);
        foreach (var t in activeTokens) t.IsRevoked = true;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync("User", user.Id, "PasswordReset", user.Id, "User",
            new { passwordResetCompleted = true }, cancellationToken);

        return Result<bool>.Success(true);
    }

    public async Task<Result<AuthResponseDto>> LoginCitizenAsync(
        LoginRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null)
        {
            return Result<AuthResponseDto>.Failure("Invalid email or password.");
        }

        if (!user.IsEnabled)
        {
            return Result<AuthResponseDto>.Failure("Account is disabled.");
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            return Result<AuthResponseDto>.Failure("Account is temporarily locked due to failed sign-in attempts.");
        }

        if (!await _userManager.CheckPasswordAsync(user, dto.Password))
        {
            await _userManager.AccessFailedAsync(user);
            return Result<AuthResponseDto>.Failure("Invalid email or password.");
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        if (!roles.Contains(AegisRoles.Citizen) || roles.Any(r => r != AegisRoles.Citizen))
        {
            return Result<AuthResponseDto>.Failure("STAFF_PORTAL_REQUIRED: Staff members must sign in at /staff/login.");
        }

        if (!user.EmailConfirmed)
        {
            return Result<AuthResponseDto>.Failure("EMAIL_NOT_VERIFIED: Please verify your email with the 6-digit OTP before signing in.");
        }

        var response = await GenerateAuthResponseAsync(user, roles, cancellationToken);
        return Result<AuthResponseDto>.Success(response);
    }

    public async Task<Result<AuthResponseDto>> LoginStaffAsync(
        StaffLoginRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null)
        {
            return Result<AuthResponseDto>.Failure("Invalid staff credentials.");
        }

        if (!user.IsEnabled)
        {
            return Result<AuthResponseDto>.Failure("Staff account has been disabled by an administrator.");
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            return Result<AuthResponseDto>.Failure("Staff account is temporarily locked due to failed sign-in attempts.");
        }

        if (!await _userManager.CheckPasswordAsync(user, dto.Password))
        {
            await _userManager.AccessFailedAsync(user);
            return Result<AuthResponseDto>.Failure("Invalid staff credentials.");
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var staffRoles = roles.Where(r => r != AegisRoles.Citizen).ToList();
        if (staffRoles.Count == 0)
        {
            return Result<AuthResponseDto>.Failure("CITIZEN_PORTAL_REQUIRED: Citizen accounts must sign in at /login.");
        }

        // Optional second-step email OTP controlled by Security:StaffLoginOtp
        var requireStaffOtp = bool.TryParse(_configuration["Security:StaffLoginOtp"], out var reqOtp) && reqOtp;
        if (requireStaffOtp)
        {
            if (string.IsNullOrWhiteSpace(dto.Otp))
            {
                await CreateAndQueueOtpChallengeAsync(normalizedEmail, "StaffLogin2FA", user.PreferredLanguage, cancellationToken);
                return Result<AuthResponseDto>.Success(new AuthResponseDto(
                    string.Empty, string.Empty, 0, user.Id, normalizedEmail, user.FullName, staffRoles, null, RequiresOtp: true
                ));
            }

            var otpCheck = await ValidateAndConsumeOtpAsync(normalizedEmail, "StaffLogin2FA", dto.Otp.Trim(), cancellationToken);
            if (otpCheck.IsFailure)
            {
                return Result<AuthResponseDto>.Failure(otpCheck.Error);
            }
        }

        var response = await GenerateAuthResponseAsync(user, staffRoles, cancellationToken);
        return Result<AuthResponseDto>.Success(response);
    }

    public async Task<AuthResponseDto?> RefreshTokenAsync(RefreshTokenRequestDto dto, CancellationToken cancellationToken = default)
    {
        var hash = HashValue(dto.RefreshToken);
        var storedToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash && !t.IsRevoked, cancellationToken);

        if (storedToken == null || storedToken.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(storedToken.UserId);
        if (user == null || !user.IsEnabled)
        {
            return null;
        }

        storedToken.IsRevoked = true;
        var roles = await _userManager.GetRolesAsync(user);
        var response = await GenerateAuthResponseAsync(user, roles, cancellationToken);
        storedToken.ReplacedByTokenHash = HashValue(response.RefreshToken);
        await _context.SaveChangesAsync(cancellationToken);

        return response;
    }

    public async Task<bool> RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var hash = HashValue(token);
        var storedToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash && !t.IsRevoked, cancellationToken);

        if (storedToken == null) return false;

        storedToken.IsRevoked = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<Result<string>> InviteStaffAsync(
        InviteStaffRequestDto dto,
        string adminUserId,
        string frontendOrigin,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        if (!AegisRoles.All.Contains(dto.Role) || dto.Role == AegisRoles.Citizen)
        {
            return Result<string>.Failure($"Invalid staff role '{dto.Role}'.");
        }

        var rawTokenBytes = RandomNumberGenerator.GetBytes(32);
        var rawToken = Convert.ToHexStringLower(rawTokenBytes);
        var tokenHash = HashValue(rawToken);

        var invite = new StaffInvitation
        {
            Email = normalizedEmail,
            FullName = dto.FullName.Trim(),
            Role = dto.Role,
            PreferredLanguage = dto.Language ?? "en",
            TokenHash = tokenHash,
            ExpiresAtUtc = DateTime.UtcNow.AddHours(24),
            InvitedById = adminUserId
        };

        _context.StaffInvitations.Add(invite);

        var setPasswordLink = $"{frontendOrigin.TrimEnd('/')}/set-password?email={Uri.EscapeDataString(normalizedEmail)}&token={rawToken}";
        var outbox = NotificationFactory.CreateStaffInviteEmail(
            normalizedEmail, dto.FullName.Trim(), dto.Role, setPasswordLink, dto.Language ?? "en", invite.Id.ToString());

        _context.NotificationOutboxes.Add(outbox);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync("StaffInvitation", invite.Id.ToString(), "InviteStaff", adminUserId, AegisRoles.SystemAdmin,
            new { email = normalizedEmail, role = dto.Role, expiresAtUtc = invite.ExpiresAtUtc }, cancellationToken);

        return Result<string>.Success(invite.Id.ToString());
    }

    public async Task<Result<AuthResponseDto>> AcceptStaffInviteAsync(
        AcceptStaffInviteRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
        var tokenHash = HashValue(dto.Token.Trim());

        var invite = await _context.StaffInvitations
            .FirstOrDefaultAsync(i => i.Email == normalizedEmail && i.TokenHash == tokenHash && i.AcceptedAtUtc == null, cancellationToken);

        if (invite == null || invite.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return Result<AuthResponseDto>.Failure("Invitation token is invalid or has expired (24-hour limit).");
        }

        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
        ApplicationUser user;

        if (existingUser == null)
        {
            user = new ApplicationUser
            {
                UserName = normalizedEmail,
                Email = normalizedEmail,
                FullName = invite.FullName,
                PreferredLanguage = invite.PreferredLanguage,
                EmailConfirmed = true,
                IsEnabled = true
            };
            var createRes = await _userManager.CreateAsync(user, dto.Password);
            if (!createRes.Succeeded)
            {
                return Result<AuthResponseDto>.Failure(string.Join("; ", createRes.Errors.Select(e => e.Description)));
            }
        }
        else
        {
            user = existingUser;
            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var resetRes = await _userManager.ResetPasswordAsync(user, resetToken, dto.Password);
            if (!resetRes.Succeeded)
            {
                return Result<AuthResponseDto>.Failure(string.Join("; ", resetRes.Errors.Select(e => e.Description)));
            }
            user.EmailConfirmed = true;
            user.IsEnabled = true;
            await _userManager.UpdateAsync(user);
        }

        if (!await _userManager.IsInRoleAsync(user, invite.Role))
        {
            await _userManager.AddToRoleAsync(user, invite.Role);
        }

        invite.AcceptedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync("StaffInvitation", invite.Id.ToString(), "AcceptInvite", user.Id, invite.Role,
            new { email = normalizedEmail, role = invite.Role }, cancellationToken);

        var roles = await _userManager.GetRolesAsync(user);
        var auth = await GenerateAuthResponseAsync(user, roles, cancellationToken);
        return Result<AuthResponseDto>.Success(auth);
    }

    public async Task<Result<bool>> SetStaffEnabledAsync(
        string targetUserId,
        bool isEnabled,
        string adminUserId,
        CancellationToken cancellationToken = default)
    {
        if (targetUserId == adminUserId && !isEnabled)
        {
            return Result<bool>.Failure("SystemAdmin cannot disable their own active account.");
        }

        var user = await _userManager.FindByIdAsync(targetUserId);
        if (user == null)
        {
            return Result<bool>.Failure("Target staff user not found.");
        }

        user.IsEnabled = isEnabled;
        await _userManager.UpdateAsync(user);

        if (!isEnabled)
        {
            var tokens = await _context.RefreshTokens.Where(t => t.UserId == user.Id && !t.IsRevoked).ToListAsync(cancellationToken);
            foreach (var t in tokens) t.IsRevoked = true;
            await _context.SaveChangesAsync(cancellationToken);
        }

        await _auditService.AppendAsync("User", user.Id, isEnabled ? "EnableStaff" : "DisableStaff", adminUserId, AegisRoles.SystemAdmin,
            new { targetUserId = user.Id, isEnabled }, cancellationToken);

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> ChangeStaffRoleAsync(
        string targetUserId,
        ChangeStaffRoleDto dto,
        string adminUserId,
        CancellationToken cancellationToken = default)
    {
        // Two-Person Integrity Rule for role changes
        if (string.IsNullOrWhiteSpace(dto.SecondApproverId))
        {
            return Result<bool>.Failure("Role changes are a critical security action and require a SecondApproverId.");
        }

        if (dto.SecondApproverId.Equals(adminUserId, StringComparison.OrdinalIgnoreCase))
        {
            return Result<bool>.Failure("Integrity violation: The second approver must be a different individual than the primary administrator.");
        }

        if (string.IsNullOrWhiteSpace(dto.Justification))
        {
            return Result<bool>.Failure("A written justification is mandatory when changing staff roles.");
        }

        if (!AegisRoles.All.Contains(dto.NewRole) || dto.NewRole == AegisRoles.Citizen)
        {
            return Result<bool>.Failure($"Invalid target staff role '{dto.NewRole}'.");
        }

        var user = await _userManager.FindByIdAsync(targetUserId);
        if (user == null)
        {
            return Result<bool>.Failure("Target staff user not found.");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
        {
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
        }
        await _userManager.AddToRoleAsync(user, dto.NewRole);

        await _auditService.AppendAsync("User", user.Id, "ChangeRole", adminUserId, AegisRoles.SystemAdmin,
            new { previousRoles = currentRoles, newRole = dto.NewRole, secondApproverId = dto.SecondApproverId, justification = dto.Justification },
            cancellationToken);

        return Result<bool>.Success(true);
    }

    public async Task<IReadOnlyList<StaffMemberDto>> GetStaffMembersAsync(CancellationToken cancellationToken = default)
    {
        var users = await _context.Users.AsNoTracking().OrderByDescending(u => u.CreatedAt).ToListAsync(cancellationToken);
        var result = new List<StaffMemberDto>();

        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            if (roles.Any(r => r != AegisRoles.Citizen))
            {
                result.Add(new StaffMemberDto(
                    u.Id,
                    u.Email ?? string.Empty,
                    u.FullName,
                    roles.ToList(),
                    u.IsEnabled,
                    u.EmailConfirmed,
                    u.CreatedAt
                ));
            }
        }

        return result;
    }

    private async Task<string> CreateAndQueueOtpChallengeAsync(
        string normalizedEmail,
        string purpose,
        string language,
        CancellationToken cancellationToken)
    {
        // Generate cryptographically random 6-digit OTP (100000..999999) — NEVER logged!
        var codeInt = RandomNumberGenerator.GetInt32(100000, 1000000);
        var plainOtp = codeInt.ToString("D6");
        var codeHash = HashOtp(normalizedEmail, purpose, plainOtp);

        var now = DateTime.UtcNow;
        var challenge = new EmailOtpChallenge
        {
            Email = normalizedEmail,
            Purpose = purpose,
            CodeHash = codeHash,
            ExpiresAtUtc = now.AddMinutes(OtpExpiryMinutes),
            Attempts = 0,
            MaxAttempts = OtpMaxAttempts,
            ResendAvailableAtUtc = now.AddSeconds(OtpResendCooldownSeconds)
        };

        _context.EmailOtpChallenges.Add(challenge);

        var outbox = NotificationFactory.CreateOtpEmail(
            normalizedEmail,
            plainOtp,
            purpose,
            language,
            challenge.Id.ToString("N"));

        _context.NotificationOutboxes.Add(outbox);
        await _context.SaveChangesAsync(cancellationToken);

        return plainOtp;
    }

    private async Task<Result<bool>> ValidateAndConsumeOtpAsync(
        string normalizedEmail,
        string purpose,
        string candidateOtp,
        CancellationToken cancellationToken)
    {
        var challenge = await _context.EmailOtpChallenges
            .Where(c => c.Email == normalizedEmail && c.Purpose == purpose && c.ConsumedAtUtc == null)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (challenge == null)
        {
            return Result<bool>.Failure("No active verification code found. Please request a new code.");
        }

        if (challenge.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return Result<bool>.Failure("Verification code has expired (10-minute limit). Please request a new code.");
        }

        if (challenge.Attempts >= challenge.MaxAttempts)
        {
            return Result<bool>.Failure("Maximum verification attempts (5) exceeded. Please request a new code.");
        }

        challenge.Attempts += 1;

        var candidateHash = HashOtp(normalizedEmail, purpose, candidateOtp);
        var match = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(challenge.CodeHash),
            Encoding.UTF8.GetBytes(candidateHash));

        if (!match)
        {
            await _context.SaveChangesAsync(cancellationToken);
            var remaining = Math.Max(0, challenge.MaxAttempts - challenge.Attempts);
            return Result<bool>.Failure($"Invalid verification code ({remaining} attempts remaining).");
        }

        challenge.ConsumedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true);
    }

    public static string HashOtp(string normalizedEmail, string purpose, string otpCode)
    {
        var raw = $"AEGIS_OTP_V1|{normalizedEmail.ToLowerInvariant()}|{purpose}|{otpCode}";
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
    }

    private async Task<AuthResponseDto> GenerateAuthResponseAsync(
        ApplicationUser user,
        IList<string> roles,
        CancellationToken cancellationToken)
    {
        var key = _configuration["Jwt:Key"] ?? "AegisDevSecretKeyForJwtAuthenticationMustBeAtLeast32BytesLong!";
        var issuer = _configuration["Jwt:Issuer"] ?? "AegisBackendApi";
        var audience = _configuration["Jwt:Audience"] ?? "AegisFrontendApp";
        var expiryMinutes = int.TryParse(_configuration["Jwt:ExpiryMinutes"], out var exp) ? exp : 15;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("fullName", user.FullName),
            new("language", user.PreferredLanguage)
        };

        if (user.OrganisationId.HasValue)
        {
            claims.Add(new Claim("orgId", user.OrganisationId.Value.ToString()));
        }

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(expiryMinutes),
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = credentials
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        var accessToken = tokenHandler.WriteToken(token);

        var rawRefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashValue(rawRefreshToken),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponseDto(
            accessToken,
            rawRefreshToken,
            expiryMinutes * 60,
            user.Id,
            user.Email ?? string.Empty,
            user.FullName,
            roles.ToList(),
            user.MaskedNic,
            RequiresOtp: false
        );
    }

    private static string HashValue(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexStringLower(bytes);
    }
}

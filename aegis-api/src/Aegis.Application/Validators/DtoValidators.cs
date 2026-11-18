using System.Text.RegularExpressions;
using Aegis.Application.DTOs;
using Aegis.Domain.Enums;
using FluentValidation;

namespace Aegis.Application.Validators;

public static class SriLankaValidationPatterns
{
    // Old NIC: 9 digits + V/X (case-insensitive). New NIC: 12 digits.
    public static readonly Regex NicRegex = new(@"^(?:[0-9]{9}[vVxX]|[0-9]{12})$", RegexOptions.Compiled);

    // Sri Lankan mobile: +947XXXXXXXX or 07XXXXXXXX
    public static readonly Regex MobileRegex = new(@"^(?:\+94|0)7[0-9]{8}$", RegexOptions.Compiled);

    // 6-digit numeric OTP
    public static readonly Regex OtpRegex = new(@"^[0-9]{6}$", RegexOptions.Compiled);
}

public class CreateRequestDtoValidator : AbstractValidator<CreateRequestDto>
{
    public CreateRequestDtoValidator()
    {
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100).WithMessage("Category is required.");
        RuleFor(x => x.Description).NotEmpty().MinimumLength(5).MaximumLength(2000).WithMessage("Description must be between 5 and 2000 characters.");
        RuleFor(x => x.Area).NotEmpty().MaximumLength(150).WithMessage("Area/Location name is required.");
        RuleFor(x => x.Latitude).InclusiveBetween(-90.0, 90.0).WithMessage("Latitude must be between -90 and 90.");
        RuleFor(x => x.Longitude).InclusiveBetween(-180.0, 180.0).WithMessage("Longitude must be between -180 and 180.");
        RuleFor(x => x.SelfReportedUrgency).InclusiveBetween(1, 5).WithMessage("Urgency must be rated 1 to 5.");
        RuleFor(x => x.PeopleCount).GreaterThan(0).WithMessage("People count must be at least 1.");
        RuleFor(x => x.ConsentGiven).Equal(true).WithMessage("Consent to process emergency request is required.");
    }
}

public class SubmitFeedbackDtoValidator : AbstractValidator<SubmitFeedbackDto>
{
    public SubmitFeedbackDtoValidator()
    {
        RuleFor(x => x.Rating).InclusiveBetween(1, 5).WithMessage("Rating must be between 1 and 5.");
        RuleFor(x => x.Comment).MaximumLength(1000);
    }
}

public class RegisterCitizenRequestDtoValidator : AbstractValidator<RegisterCitizenRequestDto>
{
    public RegisterCitizenRequestDtoValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(100).WithMessage("Full name is required.");
        RuleFor(x => x.Nic)
            .NotEmpty()
            .Must(nic => !string.IsNullOrWhiteSpace(nic) && SriLankaValidationPatterns.NicRegex.IsMatch(nic.Trim()))
            .WithMessage("Invalid Sri Lankan NIC. Must be 9 digits followed by V/X or 12 digits.");
        RuleFor(x => x.Mobile)
            .NotEmpty()
            .Must(m => !string.IsNullOrWhiteSpace(m) && SriLankaValidationPatterns.MobileRegex.IsMatch(m.Trim()))
            .WithMessage("Invalid Sri Lankan mobile number (use 07XXXXXXXX or +947XXXXXXXX).");
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("A valid email address is required.");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).Matches(@"\d").WithMessage("Password must be at least 8 characters and include a digit.");
        RuleFor(x => x.Language)
            .NotEmpty()
            .Must(l => l is "en" or "si" or "ta")
            .WithMessage("Language must be 'en', 'si', or 'ta'.");
        RuleFor(x => x.ConsentGiven)
            .Equal(true)
            .WithMessage("Consent to personal data processing is required.");
    }
}

public class LoginRequestDtoValidator : AbstractValidator<LoginRequestDto>
{
    public LoginRequestDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class StaffLoginRequestDtoValidator : AbstractValidator<StaffLoginRequestDto>
{
    public StaffLoginRequestDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Otp)
            .Must(otp => string.IsNullOrWhiteSpace(otp) || SriLankaValidationPatterns.OtpRegex.IsMatch(otp.Trim()))
            .WithMessage("OTP must be a 6-digit code.");
    }
}

public class VerifyEmailOtpDtoValidator : AbstractValidator<VerifyEmailOtpDto>
{
    public VerifyEmailOtpDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Otp)
            .NotEmpty()
            .Must(otp => !string.IsNullOrWhiteSpace(otp) && SriLankaValidationPatterns.OtpRegex.IsMatch(otp.Trim()))
            .WithMessage("OTP must be exactly 6 digits.");
    }
}

public class ResetPasswordRequestDtoValidator : AbstractValidator<ResetPasswordRequestDto>
{
    public ResetPasswordRequestDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Otp)
            .NotEmpty()
            .Must(otp => !string.IsNullOrWhiteSpace(otp) && SriLankaValidationPatterns.OtpRegex.IsMatch(otp.Trim()))
            .WithMessage("OTP must be exactly 6 digits.");
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).Matches(@"\d").WithMessage("Password must be at least 8 characters and include a digit.");
    }
}

public class InviteStaffRequestDtoValidator : AbstractValidator<InviteStaffRequestDto>
{
    public InviteStaffRequestDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(r => AegisRoles.All.Contains(r) && r != AegisRoles.Citizen)
            .WithMessage("Role must be a valid staff role.");
        RuleFor(x => x.Language).Must(l => l is "en" or "si" or "ta");
    }
}

public class DecisionRequestDtoValidator : AbstractValidator<DecisionRequestDto>
{
    public DecisionRequestDtoValidator()
    {
        RuleFor(x => x.Action)
            .NotEmpty()
            .Must(a => a is "Approve" or "Modify" or "Reject" or "Defer")
            .WithMessage("Action must be Approve, Modify, Reject, or Defer.");

        RuleFor(x => x.Justification)
            .NotEmpty()
            .When(x => x.Action is "Modify" or "Reject")
            .WithMessage("Justification is mandatory when modifying or rejecting an AI recommendation.");
    }
}

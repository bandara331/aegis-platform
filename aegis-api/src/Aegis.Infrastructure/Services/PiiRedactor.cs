using System.Text.RegularExpressions;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Redacts Sri Lankan NICs, phone numbers, and email addresses before sending citizen text to external LLMs.
/// </summary>
public static partial class PiiRedactor
{
    // Sri Lankan NIC: 9 digits + V/X or 12 digits
    [GeneratedRegex(@"\b(?:\d{9}[vVxX]|\d{12})\b", RegexOptions.Compiled)]
    private static partial Regex NicRegex();

    // Sri Lankan mobile/landline numbers (+947XXXXXXXX, 07XXXXXXXX, 011XXXXXXX, spaced or hyphenated)
    [GeneratedRegex(@"(?<!\d)(?:\+94[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|0\d{2}[\s-]?\d{3}[\s-]?\d{4})(?!\d)", RegexOptions.Compiled)]
    private static partial Regex PhoneRegex();

    // Email addresses
    [GeneratedRegex(@"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();

    public static string Redact(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var redacted = EmailRegex().Replace(input, "[REDACTED_EMAIL]");
        redacted = PhoneRegex().Replace(redacted, "[REDACTED_PHONE]");
        redacted = NicRegex().Replace(redacted, "[REDACTED_NIC]");
        return redacted;
    }
}

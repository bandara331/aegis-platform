using System.Text.Json;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;

namespace Aegis.Application.Factories;

public record DualFormatEmailPayload(string PlainText, string Html);

/// <summary>
/// Factory Pattern class constructing localized HTML + plain-text email templates
/// in English (en), Sinhala (si), and Tamil (ta).
/// Pattern: Factory (NotificationFactory).
/// </summary>
public static class NotificationFactory
{
    private static string WrapHtml(string heading, string bodyHtml, string footerNote)
    {
        return $@"<!DOCTYPE html>
<html>
<body style=""margin:0;padding:24px;background:#07090D;color:#E8ECF2;font-family:system-ui,-apple-system,sans-serif;"">
  <div style=""max-width:540px;margin:0 auto;background:#0B0F16;border:1px solid #1D2430;border-radius:18px;padding:28px;"">
    <div style=""font-size:12px;letter-spacing:0.14em;color:#FF4D2E;font-weight:700;margin-bottom:10px;"">AEGIS HUMANITARIAN PLATFORM</div>
    <h2 style=""margin:0 0 16px;font-size:22px;color:#E8ECF2;"">{heading}</h2>
    <div style=""font-size:15px;line-height:1.6;color:#B4BDCA;"">{bodyHtml}</div>
    <hr style=""border:0;border-top:1px solid #1D2430;margin:24px 0 14px;"" />
    <div style=""font-size:12px;color:#7D8796;"">{footerNote}</div>
  </div>
</body>
</html>";
    }

    public static string EncodeDualPayload(string plainText, string html)
    {
        return JsonSerializer.Serialize(new DualFormatEmailPayload(plainText, html));
    }

    public static DualFormatEmailPayload DecodeDualPayload(string payload)
    {
        if (!string.IsNullOrWhiteSpace(payload) && payload.TrimStart().StartsWith('{'))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<DualFormatEmailPayload>(payload);
                if (parsed != null) return parsed;
            }
            catch
            {
                // Fallback to plain text if legacy payload
            }
        }
        return new DualFormatEmailPayload(payload, $"<p>{System.Net.WebUtility.HtmlEncode(payload)}</p>");
    }

    public static NotificationOutbox CreateOtpEmail(
        string recipientEmail,
        string otpCode,
        string purpose,
        string language,
        string idempotencySuffix)
    {
        var lang = (language ?? "en").ToLowerInvariant();
        var isReset = purpose.Equals("PasswordReset", StringComparison.OrdinalIgnoreCase);

        var (subject, heading, plainText, bodyHtml, footer) = lang switch
        {
            "si" => (
                isReset ? "AEGIS මුරපදය යළි පිහිටුවීමේ කේතය" : "AEGIS විද්‍යුත් තැපෑල තහවුරු කිරීමේ කේතය",
                isReset ? "මුරපදය යළි පිහිටුවීම" : "ඔබගේ විද්‍යුත් තැපෑල තහවුරු කරන්න",
                $"ඔබගේ AEGIS එක්වරක් භාවිතා කරන කේතය (OTP): {otpCode}. මෙම කේතය මිනිත්තු 10 කින් කල් ඉකුත් වේ.",
                $"<p>ඔබගේ ආරක්ෂිත තහවුරු කිරීමේ කේතය පහතින් දැක්වේ:</p><div style=\"font-size:32px;font-weight:800;letter-spacing:0.25em;color:#22D3EE;padding:16px;background:#07090D;border-radius:12px;text-align:center;margin:16px 0;\">{otpCode}</div><p>මෙම කේතය මිනිත්තු 10 කින් කල් ඉකුත් වේ. උපරිම උත්සාහයන් ගණන 5 කි.</p>",
                "ඔබ මෙම ඉල්ලීම සිදු නොකළේ නම් මෙම පණිවිඩය නොසලකා හරින්න."
            ),
            "ta" => (
                isReset ? "AEGIS கடவுச்சொல் மீட்டமைப்பு குறியீடு" : "AEGIS மின்னஞ்சல் சரிபார்ப்பு குறியீடு",
                isReset ? "கடவுச்சொல் மீட்டமைப்பு" : "உங்கள் மின்னஞ்சலை சரிபார்க்கவும்",
                $"உங்கள் AEGIS ஒருமுறை குறியீடு (OTP): {otpCode}. இந்த குறியீடு 10 நிமிடங்களில் காலாவதியாகும்.",
                $"<p>உங்கள் பாதுகாப்பு சரிபார்ப்பு குறியீடு:</p><div style=\"font-size:32px;font-weight:800;letter-spacing:0.25em;color:#22D3EE;padding:16px;background:#07090D;border-radius:12px;text-align:center;margin:16px 0;\">{otpCode}</div><p>இந்த குறியீடு 10 நிமிடங்களில் காலாவதியாகும் (அதிகபட்சம் 5 முயற்சிகள்).</p>",
                "நீங்கள் இதை கோரவில்லை என்றால் இந்த மின்னஞ்சலை புறக்கணிக்கவும்."
            ),
            _ => (
                isReset ? "AEGIS Password Reset Verification Code" : "AEGIS Email Verification Code",
                isReset ? "Password Reset Code" : "Verify your email address",
                $"Your AEGIS verification code is: {otpCode}. It expires in 10 minutes (maximum 5 attempts).",
                $"<p>Use the 6-digit verification code below to continue:</p><div style=\"font-size:32px;font-weight:800;letter-spacing:0.25em;color:#22D3EE;padding:16px;background:#07090D;border-radius:12px;text-align:center;margin:16px 0;\">{otpCode}</div><p>This code expires in <strong>10 minutes</strong> and allows at most 5 verification attempts.</p>",
                "Never share this code with anyone. AEGIS staff will never ask for your OTP."
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"otp:{purpose}:{recipientEmail.ToLowerInvariant()}:{idempotencySuffix}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plainText, WrapHtml(heading, bodyHtml, footer)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    public static NotificationOutbox CreateWelcomeEmail(string recipientEmail, string fullName, string language, string userId)
    {
        var lang = (language ?? "en").ToLowerInvariant();
        var (subject, heading, plainText, bodyHtml) = lang switch
        {
            "si" => (
                "AEGIS මානුෂීය වේදිකාව වෙත සාදරයෙන් පිළිගනිමු",
                $"සාදරයෙන් පිළිගනිමු, {fullName}",
                $"ආයුබෝවන් {fullName}, ඔබගේ AEGIS පුරවැසි ගිණුම සාර්ථකව තහවුරු කරන ලදී. දැන් ඔබට ආධාර ඉල්ලීම් ඉදිරිපත් කිරීමට සහ පසු විපරම් කිරීමට හැකිය.",
                $"<p>ආයුබෝවන් <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>ඔබගේ විද්‍යුත් තැපෑල තහවුරු කර ඇත. දැන් ඔබට AEGIS පුරවැසි ද්වාරය හරහා හදිසි ආධාර ඉල්ලීම් ඉදිරිපත් කළ හැකිය.</p>"
            ),
            "ta" => (
                "AEGIS மனிதாபிமான தளத்திற்கு வரவேற்கிறோம்",
                $"வரவேற்கிறோம், {fullName}",
                $"வணக்கம் {fullName}, உங்கள் AEGIS குடிமக்கள் கணக்கு சரிபார்க்கப்பட்டது. இப்போது நீங்கள் அவசர உதவி கோரிக்கைகளை சமர்ப்பிக்கலாம்.",
                $"<p>வணக்கம் <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>உங்கள் மின்னஞ்சல் உறுதிப்படுத்தப்பட்டது. இப்போது நீங்கள் AEGIS குடிமக்கள் தளம் வழியாக உதவி கோரிக்கைகளை சமர்ப்பிக்கலாம்.</p>"
            ),
            _ => (
                "Welcome to AEGIS Humanitarian Coordination Platform",
                $"Welcome, {fullName}",
                $"Hello {fullName}, your AEGIS citizen account has been verified. You can now sign in to submit and track emergency assistance requests.",
                $"<p>Hello <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>Your email address is verified and your citizen account is active. You can now submit emergency assistance requests and track coordinator decisions in real time.</p>"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"welcome:{userId}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plainText, WrapHtml(heading, bodyHtml, "AEGIS Citizen Portal · Encrypted & Audited")),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    public static NotificationOutbox CreateStaffInviteEmail(
        string recipientEmail,
        string fullName,
        string role,
        string setPasswordLink,
        string language,
        string inviteId)
    {
        var lang = (language ?? "en").ToLowerInvariant();
        var safeLink = System.Net.WebUtility.HtmlEncode(setPasswordLink);

        var (subject, heading, plainText, bodyHtml) = lang switch
        {
            "si" => (
                $"AEGIS කාර්ය මණ්ඩල ආරාධනය ({role})",
                "AEGIS කාර්ය මණ්ඩල ගිණුම සක්‍රිය කරන්න",
                $"ආයුබෝවන් {fullName}, ඔබව AEGIS හි '{role}' ලෙස පත් කර ඇත. පැය 24 ක් ඇතුළත ඔබගේ මුරපදය සැකසීමට මෙම සබැඳිය භාවිතා කරන්න: {setPasswordLink}",
                $"<p>ආයුබෝවන් <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>ඔබව AEGIS වේදිකාවේ <strong>{role}</strong> භූමිකාව සඳහා ආරාධනා කර ඇත.</p><p style=\"margin:20px 0;\"><a href=\"{safeLink}\" style=\"background:#FF4D2E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;\">මුරපදය සකසන්න (පැය 24 කින් කල් ඉකුත් වේ)</a></p>"
            ),
            "ta" => (
                $"AEGIS பணியாளர் அழைப்பு ({role})",
                "AEGIS பணியாளர் கணக்கை செயல்படுத்தவும்",
                $"வணக்கம் {fullName}, நீங்கள் AEGIS தளத்தில் '{role}' ஆக அழைக்கப்பட்டுள்ளீர்கள். 24 மணி நேரத்திற்குள் கடவுச்சொல்லை அமைக்க: {setPasswordLink}",
                $"<p>வணக்கம் <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>நீங்கள் AEGIS தளத்தில் <strong>{role}</strong> பொறுப்பிற்கு அழைக்கப்பட்டுள்ளீர்கள்.</p><p style=\"margin:20px 0;\"><a href=\"{safeLink}\" style=\"background:#FF4D2E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;\">கடவுச்சொல்லை அமைக்கவும் (24 மணி நேரம்)</a></p>"
            ),
            _ => (
                $"AEGIS Staff Invitation — {role}",
                "Set your AEGIS staff password",
                $"Hello {fullName}, you have been invited to AEGIS with role '{role}'. Use this one-time link within 24 hours to set your password: {setPasswordLink}",
                $"<p>Hello <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>A System Administrator has invited you to join AEGIS in the operational role of <strong>{role}</strong>.</p><p style=\"margin:20px 0;\"><a href=\"{safeLink}\" style=\"background:#FF4D2E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;\">Set Password (Valid 24 Hours)</a></p>"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"staff-invite:{inviteId}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plainText, WrapHtml(heading, bodyHtml, "One-time invitation token · expires in 24 hours")),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    public static NotificationOutbox CreateRequestReceivedNotification(
        AssistanceRequest request,
        string recipientEmailOrPhone,
        NotificationChannel channel = NotificationChannel.Email)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var (subject, plain) = lang switch
        {
            "si" => (
                $"AEGIS හදිසි ආධාර ඉල්ලීම ලැබුණි ({request.TrackingNumber})",
                $"ඔබගේ '{request.Category}' ආධාර ඉල්ලීම ({request.TrackingNumber}) AEGIS පද්ධතියට ලැබී ඇත. ස්ථානය: {request.Area}. AI ප්‍රමුඛතාව: {request.Priority}."
            ),
            "ta" => (
                $"AEGIS அவசர உதவி கோரிக்கை பெறப்பட்டது ({request.TrackingNumber})",
                $"உங்கள் '{request.Category}' உதவி கோரிக்கை ({request.TrackingNumber}) AEGIS தளத்தில் பதிவு செய்யப்பட்டுள்ளது. இடம்: {request.Area}. முன்னுரிமை: {request.Priority}."
            ),
            _ => (
                $"AEGIS Assistance Request Received ({request.TrackingNumber})",
                $"Your '{request.Category}' assistance request ({request.TrackingNumber}) in {request.Area} has been logged and queued for coordinator review. Triage priority: {request.Priority}."
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-created:{request.Id}:{channel}",
            Channel = channel,
            Recipient = recipientEmailOrPhone,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, $"<p>{System.Net.WebUtility.HtmlEncode(plain)}</p>", "AEGIS Emergency Coordination")),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    public static NotificationOutbox CreateDecisionNotification(
        AssistanceRequest request,
        Decision decision,
        string recipientEmailOrPhone,
        NotificationChannel channel = NotificationChannel.Email)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var (subject, plain) = lang switch
        {
            "si" => (
                $"AEGIS තීරණය යාවත්කාලීන කිරීම ({request.TrackingNumber})",
                $"ඔබගේ ඉල්ලීම ({request.TrackingNumber}) සඳහා සම්බන්ධීකාරක තීරණය: {decision.Action}. වත්මන් තත්ත්වය: {request.Status}."
            ),
            "ta" => (
                $"AEGIS தீர்மானம் புதுப்பிப்பு ({request.TrackingNumber})",
                $"உங்கள் கோரிக்கை ({request.TrackingNumber}) மீதான ஒருங்கிணைப்பாளர் முடிவு: {decision.Action}. தற்போதைய நிலை: {request.Status}."
            ),
            _ => (
                $"AEGIS Coordinator Decision Recorded ({request.TrackingNumber})",
                $"A named coordinator has recorded decision '{decision.Action}' on request {request.TrackingNumber}. Updated case status: {request.Status}."
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"decision:{decision.Id}:{channel}",
            Channel = channel,
            Recipient = recipientEmailOrPhone,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, $"<p>{System.Net.WebUtility.HtmlEncode(plain)}</p>", "AEGIS Human-in-the-Loop Governance")),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }
}

public static class RecommendationFactory
{
    public static AiRecommendation CreateFromScoringResult(Guid requestId, AiScoringResult scoring)
    {
        return new AiRecommendation
        {
            RequestId = requestId,
            ModelName = scoring.ModelName,
            ModelVersion = scoring.ModelVersion,
            Priority = scoring.Priority,
            Confidence = scoring.Confidence,
            RationaleJson = scoring.RationaleJson,
            FeatureScoresJson = scoring.FeatureScoresJson,
            Status = RecommendationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }
}

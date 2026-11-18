using System.Text.Json;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;

namespace Aegis.Application.Factories;

public record DualFormatEmailPayload(string PlainText, string Html);

/// <summary>
/// Factory Pattern class constructing localized HTML + plain-text email templates
/// in English (en), Sinhala (si), and Tamil (ta).
/// Every request lifecycle email includes the reference number and a link to /my-requests/[id].
/// Pattern: Factory (NotificationFactory).
/// </summary>
public static class NotificationFactory
{
    public const string DefaultFrontendOrigin = "http://localhost:3000";

    private static string BuildRequestLink(Guid requestId, string? frontendOrigin = null)
    {
        var baseUrl = string.IsNullOrWhiteSpace(frontendOrigin)
            ? DefaultFrontendOrigin
            : frontendOrigin.TrimEnd('/');
        return $"{baseUrl}/my-requests/{requestId}";
    }

    private static string WrapHtml(string heading, string bodyHtml, string footerNote, string? actionLink = null, string? actionText = null)
    {
        var ctaBlock = !string.IsNullOrWhiteSpace(actionLink) && !string.IsNullOrWhiteSpace(actionText)
            ? $@"<p style=""margin:20px 0;""><a href=""{System.Net.WebUtility.HtmlEncode(actionLink)}"" style=""display:inline-block;background:#0B7A87;color:#FFFFFF;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;"">{System.Net.WebUtility.HtmlEncode(actionText)}</a></p>"
            : string.Empty;

        return $@"<!DOCTYPE html>
<html>
<body style=""margin:0;padding:24px;background:#F2F4FA;color:#0C1230;font-family:system-ui,-apple-system,sans-serif;"">
  <div style=""max-width:540px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E4F0;border-radius:24px;padding:28px;"">
    <div style=""font-size:11px;letter-spacing:0.14em;color:#FF5A4F;font-weight:700;margin-bottom:10px;"">AEGIS HUMANITARIAN PLATFORM</div>
    <h2 style=""margin:0 0 16px;font-size:22px;color:#0C1230;"">{heading}</h2>
    <div style=""font-size:15px;line-height:1.6;color:#2E3558;"">{bodyHtml}{ctaBlock}</div>
    <hr style=""border:0;border-top:1px solid #E2E4F0;margin:24px 0 14px;"" />
    <div style=""font-size:12px;color:#585E7A;"">{footerNote}</div>
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
                $"<p>ඔබගේ ආරක්ෂිත තහවුරු කිරීමේ කේතය පහතින් දැක්වේ:</p><div style=\"font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0B7A87;padding:16px;background:#F2F4FA;border-radius:12px;text-align:center;margin:16px 0;\">{otpCode}</div><p>මෙම කේතය මිනිත්තු 10 කින් කල් ඉකුත් වේ. උපරිම උත්සාහයන් ගණන 5 කි.</p>",
                "ඔබ මෙම ඉල්ලීම සිදු නොකළේ නම් මෙම පණිවිඩය නොසලකා හරින්න."
            ),
            "ta" => (
                isReset ? "AEGIS கடவுச்சொல் மீட்டமைப்பு குறியீடு" : "AEGIS மின்னஞ்சல் சரிபார்ப்பு குறியீடு",
                isReset ? "கடவுச்சொல் மீட்டமைப்பு" : "உங்கள் மின்னஞ்சலை சரிபார்க்கவும்",
                $"உங்கள் AEGIS ஒருமுறை குறியீடு (OTP): {otpCode}. இந்த குறியீடு 10 நிமிடங்களில் காலாவதியாகும்.",
                $"<p>உங்கள் பாதுகாப்பு சரிபார்ப்பு குறியீடு:</p><div style=\"font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0B7A87;padding:16px;background:#F2F4FA;border-radius:12px;text-align:center;margin:16px 0;\">{otpCode}</div><p>இந்த குறியீடு 10 நிமிடங்களில் காலாவதியாகும் (அதிகபட்சம் 5 முயற்சிகள்).</p>",
                "நீங்கள் இதை கோரவில்லை என்றால் இந்த மின்னஞ்சலை புறக்கணிக்கவும்."
            ),
            _ => (
                isReset ? "AEGIS Password Reset Verification Code" : "AEGIS Email Verification Code",
                isReset ? "Password Reset Code" : "Verify your email address",
                $"Your AEGIS verification code is: {otpCode}. It expires in 10 minutes (maximum 5 attempts).",
                $"<p>Use the 6-digit verification code below to continue:</p><div style=\"font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0B7A87;padding:16px;background:#F2F4FA;border-radius:12px;text-align:center;margin:16px 0;\">{otpCode}</div><p>This code expires in <strong>10 minutes</strong> and allows at most 5 verification attempts.</p>",
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
        var (subject, heading, plainText, bodyHtml, ctaLabel) = lang switch
        {
            "si" => (
                $"AEGIS කාර්ය මණ්ඩල ආරාධනය ({role})",
                "AEGIS කාර්ය මණ්ඩල ගිණුම සක්‍රිය කරන්න",
                $"ආයුබෝවන් {fullName}, ඔබව AEGIS හි '{role}' ලෙස පත් කර ඇත. පැය 24 ක් ඇතුළත ඔබගේ මුරපදය සැකසීමට මෙම සබැඳිය භාවිතා කරන්න: {setPasswordLink}",
                $"<p>ආයුබෝවන් <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>ඔබව AEGIS වේදිකාවේ <strong>{role}</strong> භූමිකාව සඳහා ආරාධනා කර ඇත.</p>",
                "මුරපදය සකසන්න (පැය 24 කින් කල් ඉකුත් වේ)"
            ),
            "ta" => (
                $"AEGIS பணியாளர் அழைப்பு ({role})",
                "AEGIS பணியாளர் கணக்கை செயல்படுத்தவும்",
                $"வணக்கம் {fullName}, நீங்கள் AEGIS தளத்தில் '{role}' ஆக அழைக்கப்பட்டுள்ளீர்கள். 24 மணி நேரத்திற்குள் கடவுச்சொல்லை அமைக்க: {setPasswordLink}",
                $"<p>வணக்கம் <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>நீங்கள் AEGIS தளத்தில் <strong>{role}</strong> பொறுப்பிற்கு அழைக்கப்பட்டுள்ளீர்கள்.</p>",
                "கடவுச்சொல்லை அமைக்கவும் (24 மணி நேரம்)"
            ),
            _ => (
                $"AEGIS Staff Invitation — {role}",
                "Set your AEGIS staff password",
                $"Hello {fullName}, you have been invited to AEGIS with role '{role}'. Use this one-time link within 24 hours to set your password: {setPasswordLink}",
                $"<p>Hello <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>,</p><p>A System Administrator has invited you to join AEGIS in the operational role of <strong>{role}</strong>.</p>",
                "Set Password (Valid 24 Hours)"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"staff-invite:{inviteId}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plainText, WrapHtml(heading, bodyHtml, "One-time invitation token · expires in 24 hours", setPasswordLink, ctaLabel)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    /// <summary>1. Request received email (en/si/ta) with reference number and /my-requests/[id] link.</summary>
    public static NotificationOutbox CreateRequestReceivedNotification(
        AssistanceRequest request,
        string recipientEmailOrPhone,
        NotificationChannel channel = NotificationChannel.Email,
        string? frontendOrigin = null)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var link = BuildRequestLink(request.Id, frontendOrigin);

        var (subject, plain, htmlBody, cta) = lang switch
        {
            "si" => (
                $"AEGIS හදිසි ආධාර ඉල්ලීම ලැබුණි ({request.TrackingNumber})",
                $"ඔබගේ '{request.Category}' ආධාර ඉල්ලීම (යොමු අංකය: {request.TrackingNumber}) AEGIS පද්ධතියට ලැබී ඇත. ස්ථානය: {request.Area}. තත්ත්වය පරීක්ෂා කරන්න: {link}",
                $"<p>ඔබගේ <strong>{System.Net.WebUtility.HtmlEncode(request.Category)}</strong> ආධාර ඉල්ලීම අප වෙත ලැබී ඇත.</p><p><strong>යොමු අංකය:</strong> <code>{request.TrackingNumber}</code><br/><strong>ස්ථානය:</strong> {System.Net.WebUtility.HtmlEncode(request.Area)}<br/><strong>වත්මන් තත්ත්වය:</strong> සමාලෝචනය යටතේ (Under review)</p>",
                "ඉල්ලීමේ තත්ත්වය බලන්න"
            ),
            "ta" => (
                $"AEGIS அவசர உதவி கோரிக்கை பெறப்பட்டது ({request.TrackingNumber})",
                $"உங்கள் '{request.Category}' உதவி கோரிக்கை (குறிப்பு எண்: {request.TrackingNumber}) AEGIS தளத்தில் பதிவு செய்யப்பட்டுள்ளது. இடம்: {request.Area}. நிலையைப் பார்க்க: {link}",
                $"<p>உங்கள் <strong>{System.Net.WebUtility.HtmlEncode(request.Category)}</strong> உதவி கோரிக்கை பெறப்பட்டது.</p><p><strong>குறிப்பு எண்:</strong> <code>{request.TrackingNumber}</code><br/><strong>இடம்:</strong> {System.Net.WebUtility.HtmlEncode(request.Area)}<br/><strong>நிலை:</strong> பரிசீலனையில் உள்ளது (Under review)</p>",
                "கோரிக்கை நிலையைப் பார்க்கவும்"
            ),
            _ => (
                $"AEGIS Assistance Request Received ({request.TrackingNumber})",
                $"Your '{request.Category}' assistance request (Reference: {request.TrackingNumber}) in {request.Area} has been received and queued for coordinator review. Track status at: {link}",
                $"<p>We have received your <strong>{System.Net.WebUtility.HtmlEncode(request.Category)}</strong> emergency assistance request.</p><p><strong>Reference number:</strong> <code>{request.TrackingNumber}</code><br/><strong>Location:</strong> {System.Net.WebUtility.HtmlEncode(request.Area)}<br/><strong>Status:</strong> Under review</p>",
                "View Request Status"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-created:{request.Id}:{channel}",
            Channel = channel,
            Recipient = recipientEmailOrPhone,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, htmlBody, $"Reference: {request.TrackingNumber} · AEGIS Emergency Coordination", link, cta)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    /// <summary>2. Status changed email (en/si/ta) with reference number and /my-requests/[id] link.</summary>
    public static NotificationOutbox CreateStatusChangedNotification(
        AssistanceRequest request,
        string newStatusLabel,
        string? notes,
        string recipientEmail,
        string? frontendOrigin = null)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var link = BuildRequestLink(request.Id, frontendOrigin);
        var extraNote = string.IsNullOrWhiteSpace(notes) ? string.Empty : $" ({notes})";

        var (subject, plain, htmlBody, cta) = lang switch
        {
            "si" => (
                $"AEGIS ඉල්ලීමේ තත්ත්වය යාවත්කාලීන විය ({request.TrackingNumber})",
                $"ඔබගේ ඉල්ලීම ({request.TrackingNumber}) නව තත්ත්වයට යාවත්කාලීන විය: {newStatusLabel}{extraNote}. විස්තර බලන්න: {link}",
                $"<p>ඔබගේ <code>{request.TrackingNumber}</code> දරන ආධාර ඉල්ලීමේ තත්ත්වය යාවත්කාලීන කර ඇත.</p><p><strong>නව තත්ත්වය:</strong> {System.Net.WebUtility.HtmlEncode(newStatusLabel)}</p>",
                "තත්ත්වය බලන්න"
            ),
            "ta" => (
                $"AEGIS கோரிக்கை நிலை புதுப்பிக்கப்பட்டது ({request.TrackingNumber})",
                $"உங்கள் கோரிக்கை ({request.TrackingNumber}) நிலை மாற்றப்பட்டுள்ளது: {newStatusLabel}{extraNote}. விவரங்களுக்கு: {link}",
                $"<p>உங்கள் <code>{request.TrackingNumber}</code> கோரிக்கையின் நிலை புதுப்பிக்கப்பட்டுள்ளது.</p><p><strong>புதிய நிலை:</strong> {System.Net.WebUtility.HtmlEncode(newStatusLabel)}</p>",
                "நிலையைப் பார்க்கவும்"
            ),
            _ => (
                $"AEGIS Request Status Updated ({request.TrackingNumber})",
                $"Your assistance request ({request.TrackingNumber}) status has changed to: {newStatusLabel}{extraNote}. View details at: {link}",
                $"<p>The status of your assistance request <code>{request.TrackingNumber}</code> has been updated.</p><p><strong>New status:</strong> {System.Net.WebUtility.HtmlEncode(newStatusLabel)}</p>",
                "Track Your Request"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-status:{request.Id}:{request.Status}:{DateTime.UtcNow.Ticks}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, htmlBody, $"Reference: {request.TrackingNumber}", link, cta)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    /// <summary>3. Request approved email (en/si/ta) with reference number and /my-requests/[id] link.</summary>
    public static NotificationOutbox CreateRequestApprovedNotification(
        AssistanceRequest request,
        string recipientEmail,
        string? frontendOrigin = null,
        string? idempotencySuffix = null)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var link = BuildRequestLink(request.Id, frontendOrigin);

        var (subject, plain, htmlBody, cta) = lang switch
        {
            "si" => (
                $"AEGIS ආධාර ඉල්ලීම අනුමත කරන ලදී ({request.TrackingNumber})",
                $"ඔබගේ '{request.Category}' ඉල්ලීම ({request.TrackingNumber}) සම්බන්ධීකාරක විසින් අනුමත කර ඇත. ප්‍රතිචාර කණ්ඩායමක් දැන් සූදානම් කෙරේ. තත්ත්වය: {link}",
                $"<p>ඔබගේ <code>{request.TrackingNumber}</code> දරන <strong>{System.Net.WebUtility.HtmlEncode(request.Category)}</strong> ඉල්ලීම සම්බන්ධීකාරක විසින් <strong>අනුමත කරන ලදී</strong>.</p>",
                "ඉල්ලීම බලන්න"
            ),
            "ta" => (
                $"AEGIS உதவி கோரிக்கை அங்கீகரிக்கப்பட்டது ({request.TrackingNumber})",
                $"உங்கள் '{request.Category}' கோரிக்கை ({request.TrackingNumber}) ஒருங்கிணைப்பாளரால் அங்கீகரிக்கப்பட்டது. விவரங்களுக்கு: {link}",
                $"<p>உங்கள் <code>{request.TrackingNumber}</code> (<strong>{System.Net.WebUtility.HtmlEncode(request.Category)}</strong>) கோரிக்கை <strong>அங்கீகரிக்கப்பட்டது</strong>.</p>",
                "கோரிக்கையைப் பார்க்கவும்"
            ),
            _ => (
                $"AEGIS Assistance Request Approved ({request.TrackingNumber})",
                $"Your '{request.Category}' assistance request ({request.TrackingNumber}) has been approved by an emergency coordinator. Track updates at: {link}",
                $"<p>Your <strong>{System.Net.WebUtility.HtmlEncode(request.Category)}</strong> assistance request (<code>{request.TrackingNumber}</code>) has been <strong>approved</strong> by an emergency coordinator.</p>",
                "View Request Timeline"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-approved:{request.Id}:{idempotencySuffix ?? "v1"}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, htmlBody, $"Reference: {request.TrackingNumber}", link, cta)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    /// <summary>4. Request assigned email (en/si/ta) with reference number and /my-requests/[id] link.</summary>
    public static NotificationOutbox CreateRequestAssignedNotification(
        AssistanceRequest request,
        string? assignmentNotes,
        string recipientEmail,
        string? frontendOrigin = null,
        string? idempotencySuffix = null)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var link = BuildRequestLink(request.Id, frontendOrigin);
        var detail = string.IsNullOrWhiteSpace(assignmentNotes) ? string.Empty : $" ({assignmentNotes})";

        var (subject, plain, htmlBody, cta) = lang switch
        {
            "si" => (
                $"AEGIS සහන කණ්ඩායමක් පවරා ඇත ({request.TrackingNumber})",
                $"ඔබගේ ඉල්ලීම ({request.TrackingNumber}) සඳහා සහන කණ්ඩායමක් පවරා ඇත{detail}. තත්ත්වය පරීක්ෂා කරන්න: {link}",
                $"<p>ඔබගේ <code>{request.TrackingNumber}</code> දරන ඉල්ලීම සඳහා ක්ෂේත්‍ර සහන කණ්ඩායමක් <strong>පවරා ඇත (Assigned)</strong>.</p>",
                "ඉල්ලීම බලන්න"
            ),
            "ta" => (
                $"AEGIS மீட்புக் குழு நியமிக்கப்பட்டுள்ளது ({request.TrackingNumber})",
                $"உங்கள் கோரிக்கைக்கு ({request.TrackingNumber}) களக் குழு நியமிக்கப்பட்டுள்ளது{detail}. நிலையைப் பார்க்க: {link}",
                $"<p>உங்கள் <code>{request.TrackingNumber}</code> கோரிக்கைக்கு களக் குழு <strong>நியமிக்கப்பட்டுள்ளது (Assigned)</strong>.</p>",
                "கோரிக்கையைப் பார்க்கவும்"
            ),
            _ => (
                $"AEGIS Field Team Assigned ({request.TrackingNumber})",
                $"A relief team has been assigned to your request ({request.TrackingNumber}){detail}. Track progress at: {link}",
                $"<p>A relief team has been <strong>assigned</strong> to your assistance request <code>{request.TrackingNumber}</code>.</p>",
                "View Assignment Details"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-assigned:{request.Id}:{idempotencySuffix ?? "v1"}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, htmlBody, $"Reference: {request.TrackingNumber}", link, cta)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    /// <summary>5. Request rejected with reason email (en/si/ta) with reference number and /my-requests/[id] link.</summary>
    public static NotificationOutbox CreateRequestRejectedNotification(
        AssistanceRequest request,
        string staffReason,
        string recipientEmail,
        string? frontendOrigin = null,
        string? idempotencySuffix = null)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var link = BuildRequestLink(request.Id, frontendOrigin);
        var safeReason = string.IsNullOrWhiteSpace(staffReason) ? "Not specified" : staffReason.Trim();

        var (subject, plain, htmlBody, cta) = lang switch
        {
            "si" => (
                $"AEGIS ඉල්ලීම පිළිබඳ දැනුම්දීම ({request.TrackingNumber})",
                $"ඔබගේ ඉල්ලීම ({request.TrackingNumber}) ප්‍රතික්ෂේප කරන ලදී. හේතුව: {safeReason}. විස්තර: {link}",
                $"<p>ඔබගේ <code>{request.TrackingNumber}</code> දරන ඉල්ලීම සම්බන්ධීකාරක විසින් ප්‍රතික්ෂේප කර ඇත.</p><p><strong>කාර්ය මණ්ඩල හේතුව:</strong> {System.Net.WebUtility.HtmlEncode(safeReason)}</p>",
                "විස්තර බලන්න"
            ),
            "ta" => (
                $"AEGIS கோரிக்கை நிலை அறிவிப்பு ({request.TrackingNumber})",
                $"உங்கள் கோரிக்கை ({request.TrackingNumber}) நிராகரிக்கப்பட்டது. காரணம்: {safeReason}. விவரங்களுக்கு: {link}",
                $"<p>உங்கள் <code>{request.TrackingNumber}</code> கோரிக்கை நிராகரிக்கப்பட்டது.</p><p><strong>காரணம்:</strong> {System.Net.WebUtility.HtmlEncode(safeReason)}</p>",
                "விவரங்களைப் பார்க்கவும்"
            ),
            _ => (
                $"AEGIS Assistance Request Update ({request.TrackingNumber})",
                $"Your assistance request ({request.TrackingNumber}) could not be approved. Staff reason: {safeReason}. View details at: {link}",
                $"<p>Your assistance request <code>{request.TrackingNumber}</code> was marked as <strong>Rejected</strong>.</p><p><strong>Coordinator reason:</strong> {System.Net.WebUtility.HtmlEncode(safeReason)}</p>",
                "View Request Record"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-rejected:{request.Id}:{idempotencySuffix ?? "v1"}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, htmlBody, $"Reference: {request.TrackingNumber}", link, cta)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    /// <summary>6. Request completed email (en/si/ta) with reference number and /my-requests/[id] link.</summary>
    public static NotificationOutbox CreateRequestCompletedNotification(
        AssistanceRequest request,
        string recipientEmail,
        string? frontendOrigin = null,
        string? idempotencySuffix = null)
    {
        var lang = (request.Language ?? "en").ToLowerInvariant();
        var link = BuildRequestLink(request.Id, frontendOrigin);

        var (subject, plain, htmlBody, cta) = lang switch
        {
            "si" => (
                $"AEGIS ආධාර ඉල්ලීම සම්පූර්ණ කරන ලදී ({request.TrackingNumber})",
                $"ඔබගේ ඉල්ලීම ({request.TrackingNumber}) සාර්ථකව සම්පූර්ණ කර ඇත. කරුණාකර ඔබගේ ප්‍රතිපෝෂණය ලබා දෙන්න: {link}",
                $"<p>ඔබගේ <code>{request.TrackingNumber}</code> දරන ආධාර ඉල්ලීම <strong>සම්පූර්ණ කරන ලදී (Completed)</strong>. ඔබගේ ප්‍රතිපෝෂණය පහත සබැඳියෙන් ලබා දිය හැකිය.</p>",
                "ප්‍රතිපෝෂණය ලබා දෙන්න"
            ),
            "ta" => (
                $"AEGIS உதவி கோரிக்கை நிறைவடைந்தது ({request.TrackingNumber})",
                $"உங்கள் கோரிக்கை ({request.TrackingNumber}) நிறைவடைந்தது. உங்கள் கருத்தைப் பகிரவும்: {link}",
                $"<p>உங்கள் <code>{request.TrackingNumber}</code> உதவி கோரிக்கை <strong>நிறைவடைந்தது (Completed)</strong>. உங்கள் கருத்தை கீழே உள்ள இணைப்பில் பதிவு செய்யலாம்.</p>",
                "கருத்தைப் பகிரவும்"
            ),
            _ => (
                $"AEGIS Assistance Request Completed ({request.TrackingNumber})",
                $"Your assistance request ({request.TrackingNumber}) has been marked as completed. You can share feedback on your experience at: {link}",
                $"<p>Your assistance request <code>{request.TrackingNumber}</code> has been marked as <strong>Completed</strong>. Please let us know how the relief delivery went.</p>",
                "Leave Feedback"
            )
        };

        return new NotificationOutbox
        {
            IdempotencyKey = $"req-completed:{request.Id}:{idempotencySuffix ?? "v1"}",
            Channel = NotificationChannel.Email,
            Recipient = recipientEmail,
            Subject = subject,
            Payload = EncodeDualPayload(plain, WrapHtml(subject, htmlBody, $"Reference: {request.TrackingNumber}", link, cta)),
            Status = NotificationStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTime.UtcNow
        };
    }

    public static NotificationOutbox CreateDecisionNotification(
        AssistanceRequest request,
        Decision decision,
        string recipientEmailOrPhone,
        NotificationChannel channel = NotificationChannel.Email,
        string? frontendOrigin = null)
    {
        var suffix = decision.Id.ToString();
        return decision.Action switch
        {
            DecisionAction.Approve => CreateRequestApprovedNotification(request, recipientEmailOrPhone, frontendOrigin, suffix),
            DecisionAction.Modify => CreateRequestAssignedNotification(request, decision.Justification, recipientEmailOrPhone, frontendOrigin, suffix),
            DecisionAction.Reject => CreateRequestRejectedNotification(request, decision.Justification, recipientEmailOrPhone, frontendOrigin, suffix),
            _ => CreateStatusChangedNotification(request, "Under review", decision.Justification, recipientEmailOrPhone, frontendOrigin)
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

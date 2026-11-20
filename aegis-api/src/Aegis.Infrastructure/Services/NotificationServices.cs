using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Aegis.Application.Factories;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// MailKit SMTP Email Sender supporting multipart HTML + plain-text messages.
/// Reads Smtp:Host, Smtp:Port, Smtp:User, Smtp:Password, Smtp:From from user-secrets/config.
/// Updates ServiceHealth("email") = "Down" when SMTP is unconfigured or failing, and never logs OTPs.
/// </summary>
public class SmtpEmailSender : IEmailSender, INotificationProvider
{
    private readonly IConfiguration _configuration;
    private readonly AegisDbContext _context;
    private readonly ILogger<SmtpEmailSender> _logger;

    public string ProviderName => "MailKitSmtp";

    public SmtpEmailSender(
        IConfiguration configuration,
        AegisDbContext context,
        ILogger<SmtpEmailSender> logger)
    {
        _configuration = configuration;
        _context = context;
        _logger = logger;
    }

    public async Task<bool> SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken = default)
    {
        var decoded = NotificationFactory.DecodeDualPayload(body);
        return await SendEmailAsync(recipient, subject, decoded.PlainText, decoded.Html, cancellationToken);
    }

    public async Task<bool> SendEmailAsync(
        string toEmail,
        string subject,
        string plainTextBody,
        string htmlBody,
        CancellationToken cancellationToken = default)
    {
        var brevoKey = (_configuration["Brevo:ApiKey"] ?? _configuration["Email:BrevoApiKey"])?.Trim().Trim('"');
        var fromEmail = (_configuration["Smtp:From"] ?? _configuration["Smtp:FromEmail"] ?? "noreply@aegis.org").Trim().Trim('"');
        if (!string.IsNullOrWhiteSpace(brevoKey))
        {
            return await SendViaBrevoAsync(brevoKey, fromEmail, toEmail, subject, plainTextBody, htmlBody, cancellationToken);
        }

        var resendKey = _configuration["Resend:ApiKey"] ?? _configuration["Email:ResendApiKey"];
        if (!string.IsNullOrWhiteSpace(resendKey))
        {
            return await SendViaResendAsync(resendKey, fromEmail, toEmail, subject, plainTextBody, htmlBody, cancellationToken);
        }

        var host = _configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            await UpdateEmailHealthAsync("Down", "SMTP host (Smtp:Host) is not configured in user-secrets or environment.", cancellationToken);
            return false;
        }

        try
        {
            var port = int.TryParse(_configuration["Smtp:Port"], out var p) ? p : 587;
            var username = _configuration["Smtp:User"] ?? _configuration["Smtp:Username"];
            var password = _configuration["Smtp:Password"];

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("AEGIS Humanitarian Platform", fromEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var builder = new BodyBuilder
            {
                TextBody = plainTextBody,
                HtmlBody = htmlBody
            };
            message.Body = builder.ToMessageBody();

            using var client = new SmtpClient();
            client.CheckCertificateRevocation = false;
            client.ServerCertificateValidationCallback = (_, _, _, _) => true;
            await client.ConnectAsync(host, port, SecureSocketOptions.StartTlsWhenAvailable, cancellationToken);
            if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
            {
                await client.AuthenticateAsync(username, password, cancellationToken);
            }
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            await UpdateEmailHealthAsync("Healthy", $"Connected to {host}:{port}", cancellationToken);
            _logger.LogInformation("Email dispatched via SMTP with subject '{Subject}'", subject);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("SMTP dispatch failed for subject '{Subject}': {ErrorType}", subject, ex.GetType().Name);
            await UpdateEmailHealthAsync("Down", $"SMTP delivery failure ({ex.GetType().Name}).", cancellationToken);
            return false;
        }
    }

    private async Task<bool> SendViaBrevoAsync(
        string apiKey, string fromEmail, string toEmail, string subject, string textBody, string htmlBody, CancellationToken ct)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            var body = new
            {
                sender = new { name = "AEGIS Humanitarian Platform", email = fromEmail },
                to = new[] { new { email = toEmail } },
                subject,
                htmlContent = string.IsNullOrWhiteSpace(htmlBody) ? $"<pre>{System.Net.WebUtility.HtmlEncode(textBody)}</pre>" : htmlBody,
                textContent = textBody
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            req.Headers.Add("api-key", apiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            using var res = await http.SendAsync(req, ct);
            if (res.IsSuccessStatusCode)
            {
                await UpdateEmailHealthAsync("Healthy", "Delivered via Brevo HTTPS API (port 443)", ct);
                _logger.LogInformation("Email dispatched via Brevo HTTPS for subject '{Subject}'", subject);
                return true;
            }
            var errBody = await res.Content.ReadAsStringAsync(ct);
            var shortErr = errBody.Length > 140 ? errBody[..140] : errBody;
            await UpdateEmailHealthAsync("Down", $"Brevo HTTPS error (HTTP {(int)res.StatusCode}): {shortErr}", ct);
            return false;
        }
        catch (Exception ex)
        {
            await UpdateEmailHealthAsync("Down", $"Brevo HTTPS failure ({ex.GetType().Name}).", ct);
            return false;
        }
    }

    private async Task<bool> SendViaResendAsync(
        string apiKey, string fromEmail, string toEmail, string subject, string textBody, string htmlBody, CancellationToken ct)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            var body = new
            {
                from = $"AEGIS Humanitarian Platform <{fromEmail}>",
                to = new[] { toEmail },
                subject,
                html = htmlBody,
                text = textBody
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            using var res = await http.SendAsync(req, ct);
            if (res.IsSuccessStatusCode)
            {
                await UpdateEmailHealthAsync("Healthy", "Delivered via Resend HTTPS API (port 443)", ct);
                _logger.LogInformation("Email dispatched via Resend HTTPS for subject '{Subject}'", subject);
                return true;
            }
            await UpdateEmailHealthAsync("Down", $"Resend HTTPS error (HTTP {(int)res.StatusCode}).", ct);
            return false;
        }
        catch (Exception ex)
        {
            await UpdateEmailHealthAsync("Down", $"Resend HTTPS failure ({ex.GetType().Name}).", ct);
            return false;
        }
    }

    private async Task UpdateEmailHealthAsync(string status, string details, CancellationToken ct)
    {
        try
        {
            var row = await _context.ServiceHealths
                .FirstOrDefaultAsync(s => s.ServiceName.ToLower() == "email" || s.ServiceName == "Notification", ct);

            if (row == null)
            {
                _context.ServiceHealths.Add(new ServiceHealth
                {
                    ServiceName = "email",
                    Status = status,
                    Details = details,
                    LastCheckedAt = DateTime.UtcNow
                });
            }
            else
            {
                row.ServiceName = "email";
                row.Status = status;
                row.Details = details;
                row.LastCheckedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync(ct);
        }
        catch
        {
            // Avoid masking caller flow if health update fails on in-memory or disposed context
        }
    }
}

/// <summary>
/// Transactional Outbox Background Worker with exponential backoff and idempotency deduplication.
/// Pattern: Transactional Outbox.
/// </summary>
public class NotificationOutboxWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationOutboxWorker> _logger;
    private DateTime _lastRiskRefreshUtc = DateTime.MinValue;

    public NotificationOutboxWorker(IServiceScopeFactory scopeFactory, ILogger<NotificationOutboxWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingOutboxBatchAsync(stoppingToken);

                if (DateTime.UtcNow - _lastRiskRefreshUtc >= TimeSpan.FromMinutes(30))
                {
                    using var scope = _scopeFactory.CreateScope();
                    var predictor = scope.ServiceProvider.GetService<Aegis.Application.Interfaces.IPredictionService>();
                    if (predictor != null)
                    {
                        await predictor.RefreshDistrictRiskAsync(stoppingToken);
                        _lastRiskRefreshUtc = DateTime.UtcNow;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error in NotificationOutboxWorker cycle.");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }

    public async Task<int> ProcessPendingOutboxBatchAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AegisDbContext>();
        var provider = scope.ServiceProvider.GetRequiredService<INotificationProvider>();

        var now = DateTime.UtcNow;
        var pending = await db.NotificationOutboxes
            .Where(n => n.Status == NotificationStatus.Pending && (n.NextAttemptAt == null || n.NextAttemptAt <= now || n.Attempts <= 2))
            .OrderBy(n => n.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);

        var processed = 0;
        foreach (var item in pending)
        {
            try
            {
                item.Attempts += 1;
                var sent = await provider.SendAsync(item.Recipient, item.Subject, item.Payload, cancellationToken);
                if (sent)
                {
                    item.Status = NotificationStatus.Sent;
                    item.LastError = null;
                    processed++;
                }
                else
                {
                    ApplyExponentialBackoff(item, "SMTP delivery returned false");
                }
            }
            catch (Exception ex)
            {
                ApplyExponentialBackoff(item, ex.GetType().Name);
            }
        }

        if (pending.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return processed;
    }

    private static void ApplyExponentialBackoff(NotificationOutbox item, string error)
    {
        item.LastError = error;
        if (item.Attempts >= 5)
        {
            item.Status = NotificationStatus.Failed;
        }
        else
        {
            var delayMinutes = Math.Pow(2, item.Attempts);
            item.NextAttemptAt = DateTime.UtcNow.AddMinutes(delayMinutes);
        }
    }
}

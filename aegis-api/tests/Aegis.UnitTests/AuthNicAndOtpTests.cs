using Aegis.Application.DTOs;
using Aegis.Application.Factories;
using Aegis.Application.Validators;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aegis.UnitTests;

public class AuthNicAndOtpTests
{
    private static IConfiguration BuildTestConfig(Dictionary<string, string?>? overrides = null)
    {
        var defaults = new Dictionary<string, string?>
        {
            ["Security:NicEncryptionKey"] = "unit-test-aes-256-gcm-encryption-secret-key",
            ["Security:NicHashKey"] = "unit-test-hmac-sha256-hash-secret-key"
        };
        if (overrides != null)
        {
            foreach (var kv in overrides) defaults[kv.Key] = kv.Value;
        }
        return new ConfigurationBuilder().AddInMemoryCollection(defaults).Build();
    }

    [Theory]
    [InlineData("901234567V", true)]
    [InlineData("852345678x", true)]
    [InlineData("199512345678", true)]
    [InlineData("12345678V", false)]     // Too short
    [InlineData("901234567A", false)]    // Invalid suffix
    [InlineData("19951234567", false)]   // 11 digits
    public void SriLankanNicValidator_ShouldValidateOldAndNewFormats(string nic, bool expectedValid)
    {
        var validator = new RegisterCitizenRequestDtoValidator();
        var dto = new RegisterCitizenRequestDto(
            "Test Citizen",
            nic,
            "0771234567",
            "citizen@test.lk",
            "Password123",
            "en",
            true);

        var result = validator.Validate(dto);
        result.IsValid.Should().Be(expectedValid);
    }

    [Fact]
    public void NicCryptoService_ShouldEncryptWithAesGcm_ComputeDeterministicHmac_AndMaskOutput()
    {
        var crypto = new NicCryptoService(BuildTestConfig());

        var cipher1 = crypto.EncryptNic("901234567v");
        var cipher2 = crypto.EncryptNic("901234567V");

        // AES-256-GCM uses a fresh 96-bit random nonce each time
        cipher1.Should().NotBe(cipher2);
        crypto.DecryptNic(cipher1).Should().Be("901234567V");
        crypto.DecryptNic(cipher2).Should().Be("901234567V");

        // HMAC-SHA256 is deterministic on normalized NIC for unique indexing
        var hmac1 = crypto.ComputeNicHmac(" 901234567v ");
        var hmac2 = crypto.ComputeNicHmac("901234567V");
        hmac1.Should().Be(hmac2);
        hmac1.Should().HaveLength(64);

        // Masked display hides leading digits
        crypto.MaskNic("901234567V").Should().Be("*******67V");
        crypto.MaskNic("199512345678").Should().Be("*********678");
    }

    [Theory]
    [InlineData("en")]
    [InlineData("si")]
    [InlineData("ta")]
    public void NotificationFactory_ShouldBuildHtmlAndPlainTextTemplates_InAllThreeLanguages(string lang)
    {
        var otpOutbox = NotificationFactory.CreateOtpEmail("user@test.lk", "482910", "VerifyEmail", lang, "id1");
        var decodedOtp = NotificationFactory.DecodeDualPayload(otpOutbox.Payload);
        decodedOtp.PlainText.Should().Contain("482910");
        decodedOtp.Html.Should().Contain("482910").And.Contain("<!DOCTYPE html>");

        var welcomeOutbox = NotificationFactory.CreateWelcomeEmail("user@test.lk", "Nimal", lang, "u1");
        var decodedWelcome = NotificationFactory.DecodeDualPayload(welcomeOutbox.Payload);
        decodedWelcome.PlainText.Should().Contain("Nimal");
        decodedWelcome.Html.Should().Contain("Nimal");

        var inviteOutbox = NotificationFactory.CreateStaffInviteEmail(
            "staff@test.lk", "Ayesha", "CaseManager", "https://aegis.local/set-password?token=abc", lang, "inv1");
        var decodedInvite = NotificationFactory.DecodeDualPayload(inviteOutbox.Payload);
        decodedInvite.PlainText.Should().Contain("https://aegis.local/set-password?token=abc");
        decodedInvite.Html.Should().Contain("CaseManager");
    }

    [Fact]
    public async Task SmtpEmailSender_WhenSmtpNotConfigured_ShouldSetServiceHealthEmailDown()
    {
        var options = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase("smtp-health-" + Guid.NewGuid())
            .Options;
        using var db = new AegisDbContext(options);

        var config = BuildTestConfig(new Dictionary<string, string?> { ["Smtp:Host"] = "" });
        var sender = new SmtpEmailSender(config, db, NullLogger<SmtpEmailSender>.Instance);

        var sent = await sender.SendEmailAsync("user@test.lk", "Subject", "Plain body", "<p>HTML body</p>");
        sent.Should().BeFalse();

        var health = await db.ServiceHealths.FirstOrDefaultAsync(s => s.ServiceName == "email");
        health.Should().NotBeNull();
        health!.Status.Should().Be("Down");
    }
}

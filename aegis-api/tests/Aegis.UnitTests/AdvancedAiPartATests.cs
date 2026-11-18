using System.Net;
using System.Text;
using System.Text.Json;
using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Entities;
using Aegis.Domain.Enums;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Services;
using Aegis.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Aegis.UnitTests;

public class AdvancedAiPartATests
{
    private sealed class StubAuditService : IAuditService
    {
        public Task<AuditLogEntry> AppendAsync(string entityName, string entityId, string action, string actorId, string actorRole, object details, CancellationToken cancellationToken = default)
            => Task.FromResult(new AuditLogEntry { EntityName = entityName, EntityId = entityId, Action = action, ActorId = actorId, ActorRole = actorRole });
        public Task<(bool IsValid, long? BrokenSequenceNumber, string? ErrorMessage)> VerifyChainAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<(bool, long?, string?)>((true, null, null));
    }
    private static AegisDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AegisDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AegisDbContext(opts);
    }

    private sealed class StubHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;
        public string? LastRequestBody { get; private set; }

        public StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Content != null)
            {
                LastRequestBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }
            return _handler(request);
        }
    }

    private static IConfiguration BuildGroqConfig(string apiKey = "test-groq-key") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Groq:ApiKey"] = apiKey,
                ["Groq:Model"] = "openai/gpt-oss-20b"
            })
            .Build();

    [Fact]
    public void PiiRedactor_Redacts_SriLankan_Nic_Phone_And_Email()
    {
        var input = "My NIC is 912345678V and new NIC 199512345678. Call 0771234567 or +94 71 987 6543, email help@example.lk";
        var redacted = PiiRedactor.Redact(input);

        Assert.DoesNotContain("912345678V", redacted);
        Assert.DoesNotContain("199512345678", redacted);
        Assert.DoesNotContain("0771234567", redacted);
        Assert.DoesNotContain("+94 71 987 6543", redacted);
        Assert.DoesNotContain("help@example.lk", redacted);
        Assert.Contains("[REDACTED_NIC]", redacted);
        Assert.Contains("[REDACTED_PHONE]", redacted);
        Assert.Contains("[REDACTED_EMAIL]", redacted);
    }

    [Fact]
    public async Task GroqMultilingualNlu_Parses_Mocked_Singlish_And_Redacts_Pii_Before_Sending()
    {
        var groqPayload = new
        {
            choices = new[]
            {
                new
                {
                    message = new
                    {
                        content = JsonSerializer.Serialize(new
                        {
                            detectedLanguage = "Singlish",
                            normalizedText = "අපේ ගෙදර වතුර නැහැ, 5 දෙනෙක් ඉන්නවා",
                            englishText = "Our house has no water, 5 people are stranded.",
                            extracted = new
                            {
                                needType = "Water",
                                peopleCount = 5,
                                locationHints = new[] { "Kaduwela" },
                                medicalTerms = Array.Empty<string>()
                            },
                            confidence = 0.91
                        })
                    }
                }
            }
        };

        var handler = new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(groqPayload), Encoding.UTF8, "application/json")
        });

        var svc = new GroqMultilingualNluService(
            new HttpClient(handler),
            BuildGroqConfig(),
            NullLogger<GroqMultilingualNluService>.Instance);

        var raw = "Ape gedara Kaduwela wathura naha 5 denek innawa NIC 912345678V tel 0771234567";
        var result = await svc.NormalizeAsync(raw, "si");

        Assert.Equal("singlish", result.DetectedLanguage, ignoreCase: true);
        Assert.Equal("Our house has no water, 5 people are stranded.", result.EnglishText);
        Assert.Equal("Water", result.Extracted.NeedType);
        Assert.Equal(5, result.Extracted.PeopleCount);
        Assert.Equal(0.91, result.Confidence);
        Assert.NotNull(handler.LastRequestBody);
        Assert.DoesNotContain("912345678V", handler.LastRequestBody);
        Assert.DoesNotContain("0771234567", handler.LastRequestBody);
    }

    [Fact]
    public async Task GroqMultilingualNlu_Invalid_Json_Falls_Back_To_Transliteration_Engine()
    {
        var badGroq = new
        {
            choices = new[]
            {
                new { message = new { content = "NOT VALID JSON {{{{" } }
            }
        };

        var handler = new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(badGroq), Encoding.UTF8, "application/json")
        });

        var svc = new GroqMultilingualNluService(
            new HttpClient(handler),
            BuildGroqConfig(),
            NullLogger<GroqMultilingualNluService>.Instance);

        var result = await svc.NormalizeAsync("ape gedara wathura naha beheth one 4 denek innawa", "en");

        Assert.True(result.UsedFallback);
        Assert.Equal("singlish", result.DetectedLanguage, ignoreCase: true);
        Assert.Contains("water", result.EnglishText, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("medicine", result.EnglishText, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(4, result.Extracted.PeopleCount);
    }

    [Fact]
    public async Task Shadow_Mode_Stores_Recommendation_Silently_And_Hides_From_Staff()
    {
        await using var db = CreateDb();
        db.AiGovernanceConfigs.Add(new AiGovernanceConfig
        {
            Mode = "Shadow",
            ConfidenceThreshold = 0.60,
            FairnessDisparityThreshold = 0.15,
            UpdatedById = "admin-1",
            UpdatedReason = "Shadow evaluation",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var audit = new StubAuditService();
        var gov = new AiGovernanceService(db, audit);
        var ai = new RuleBasedAiProvider(db, NullLogger<RuleBasedAiProvider>.Instance);
        var reqSvc = new RequestService(db, ai, audit, NullLogger<RequestService>.Instance, null, gov);
        var decSvc = new DecisionService(db, audit, NullLogger<DecisionService>.Instance);

        var created = await reqSvc.CreateRequestAsync(
            new CreateRequestDto(null, "Medical", "Need insulin urgently", "en", "Colombo", 6.9271, 79.8612, 2, 5, true),
            "cit-1", null);

        Assert.Equal("ManualTriage", created.Status);
        Assert.Equal("Manual", created.AiPriority);
        Assert.Equal(0.0, created.AiConfidence);
        Assert.Null(created.RecommendationId);

        // Stored in DB with IsShadow = true
        var storedRec = await db.AiRecommendations.SingleAsync();
        Assert.True(storedRec.IsShadow);

        // Hidden from staff endpoints
        Assert.Null(await decSvc.GetLatestForRequestAsync(created.Id));
        Assert.Empty(await decSvc.GetPendingRecommendationsAsync());
    }

    [Fact]
    public async Task Off_Mode_KillSwitch_Routes_To_ManualTriage_Without_AiRecommendation()
    {
        await using var db = CreateDb();
        db.AiGovernanceConfigs.Add(new AiGovernanceConfig
        {
            Mode = "Off",
            ConfidenceThreshold = 0.60,
            FairnessDisparityThreshold = 0.15,
            UpdatedById = "admin-1",
            UpdatedReason = "Emergency kill switch",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var audit = new StubAuditService();
        var gov = new AiGovernanceService(db, audit);
        var ai = new RuleBasedAiProvider(db, NullLogger<RuleBasedAiProvider>.Instance);
        var reqSvc = new RequestService(db, ai, audit, NullLogger<RequestService>.Instance, null, gov);

        var created = await reqSvc.CreateRequestAsync(
            new CreateRequestDto(null, "Food", "Need dry rations", "en", "Galle", 6.0535, 80.2210, 3, 3, true),
            "cit-2", null);

        Assert.Equal("ManualTriage", created.Status);
        Assert.Empty(await db.AiRecommendations.ToListAsync());
    }

    [Fact]
    public async Task Below_Confidence_Threshold_Marks_NeedsReview_And_Suppresses_SuggestedAction()
    {
        await using var db = CreateDb();
        db.AiGovernanceConfigs.Add(new AiGovernanceConfig
        {
            Mode = "Active",
            ConfidenceThreshold = 0.99,
            FairnessDisparityThreshold = 0.15,
            UpdatedById = "admin-1",
            UpdatedReason = "High confidence gate",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var audit = new StubAuditService();
        var gov = new AiGovernanceService(db, audit);
        var ai = new RuleBasedAiProvider(db, NullLogger<RuleBasedAiProvider>.Instance);
        var reqSvc = new RequestService(db, ai, audit, NullLogger<RequestService>.Instance, null, gov);

        var created = await reqSvc.CreateRequestAsync(
            new CreateRequestDto(null, "Food", "Need rice packets", "en", "Kandy", 7.2906, 80.6337, 2, 2, true),
            "cit-3", null);

        Assert.Equal("NeedsReview", created.Status);
        var rec = await db.AiRecommendations.SingleAsync();
        Assert.True(rec.BelowThreshold);
        Assert.Contains("Needs human review", rec.RationaleJson);
    }

    [Fact]
    public async Task Governance_Analytics_Computes_Override_Rates_Calibration_And_Fairness()
    {
        await using var db = CreateDb();
        db.AiGovernanceConfigs.Add(new AiGovernanceConfig
        {
            Mode = "Active",
            ConfidenceThreshold = 0.60,
            FairnessDisparityThreshold = 0.10,
            UpdatedById = "admin-1",
            UpdatedReason = "Baseline",
            UpdatedAt = DateTime.UtcNow
        });

        var r1 = new AssistanceRequest { TrackingNumber = "AEG-1", Category = "Medical", Area = "Colombo", Language = "en", DetectedLanguage = "en", Priority = RequestPriority.Critical, Description = "d1" };
        var r1b = new AssistanceRequest { TrackingNumber = "AEG-1B", Category = "Medical", Area = "Colombo", Language = "en", DetectedLanguage = "en", Priority = RequestPriority.Critical, Description = "d1b" };
        var r2 = new AssistanceRequest { TrackingNumber = "AEG-2", Category = "Water", Area = "Jaffna", Language = "ta", DetectedLanguage = "ta", Priority = RequestPriority.Low, Description = "d2" };
        var r2b = new AssistanceRequest { TrackingNumber = "AEG-2B", Category = "Water", Area = "Jaffna", Language = "ta", DetectedLanguage = "ta", Priority = RequestPriority.Low, Description = "d2b" };
        db.AssistanceRequests.AddRange(r1, r1b, r2, r2b);

        var rec1 = new AiRecommendation { RequestId = r1.Id, Request = r1, Confidence = 0.85, Priority = RequestPriority.Critical, Status = RecommendationStatus.Approved };
        var rec1b = new AiRecommendation { RequestId = r1b.Id, Request = r1b, Confidence = 0.85, Priority = RequestPriority.Critical, Status = RecommendationStatus.Approved };
        var rec2 = new AiRecommendation { RequestId = r2.Id, Request = r2, Confidence = 0.45, Priority = RequestPriority.Low, Status = RecommendationStatus.Modified };
        var rec2b = new AiRecommendation { RequestId = r2b.Id, Request = r2b, Confidence = 0.45, Priority = RequestPriority.Low, Status = RecommendationStatus.Modified };
        db.AiRecommendations.AddRange(rec1, rec1b, rec2, rec2b);

        db.Decisions.AddRange(
            new Decision { RecommendationId = rec1.Id, Recommendation = rec1, Action = DecisionAction.Approve, DecidedById = "coord-1", Justification = "ok", DecidedAt = DateTime.UtcNow },
            new Decision { RecommendationId = rec2.Id, Recommendation = rec2, Action = DecisionAction.Modify, DecidedById = "coord-1", Justification = "raise", DecidedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var gov = new AiGovernanceService(db, new StubAuditService());
        var analytics = await gov.GetAnalyticsAsync(null, null);

        Assert.Equal(4, analytics.DecidedCount);
        Assert.Equal(0.5, analytics.AgreementRate);
        Assert.Equal(2, analytics.CalibrationBuckets.Count);
        Assert.Contains(analytics.FairnessByLanguage, f => f.Flagged);
    }

    [Fact]
    public void Counterfactual_Note_Is_Deterministic_From_Rule_Thresholds()
    {
        var mediumNote = RuleBasedAiProvider.BuildCounterfactualNote(RequestPriority.Medium, 55, "Food", 3);
        var highNote = RuleBasedAiProvider.BuildCounterfactualNote(RequestPriority.High, 72, "Medical", 2);
        var criticalNote = RuleBasedAiProvider.BuildCounterfactualNote(RequestPriority.Critical, 90, "Medical", 4);

        Assert.Contains("2 hours", mediumNote);
        Assert.Contains("Critical", mediumNote);
        Assert.Contains("Critical", highNote);
        Assert.Contains("High", criticalNote);
    }
}

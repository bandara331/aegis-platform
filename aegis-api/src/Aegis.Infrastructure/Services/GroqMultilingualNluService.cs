using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Aegis.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

public class GroqMultilingualNluService : IMultilingualNluService
{
    public const string PromptVersion = "aegis-nlp-v3.0";
    private const string GroqEndpoint = "https://api.groq.com/openai/v1/chat/completions";

    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<GroqMultilingualNluService> _logger;

    private static readonly Dictionary<string, (string English, string NeedType, string? MedicalTerm)> SinglishLexicon =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["watura"] = ("water", "Water", null),
            ["wathura"] = ("water", "Water", null),
            ["vathura"] = ("water", "Water", null),
            ["jalaya"] = ("water", "Water", null),
            ["thanni"] = ("water", "Water", null),
            ["thanneer"] = ("water", "Water", null),
            ["beheth"] = ("medicine", "Medical", "medicine"),
            ["behet"] = ("medicine", "Medical", "medicine"),
            ["marunthu"] = ("medicine", "Medical", "medicine"),
            ["insulin"] = ("insulin", "Medical", "insulin"),
            ["oxygen"] = ("oxygen", "Medical", "oxygen"),
            ["asaneepa"] = ("sick / medical emergency", "Medical", "illness"),
            ["le"] = ("bleeding", "Medical", "bleeding"),
            ["kema"] = ("food", "Food", null),
            ["kaema"] = ("food", "Food", null),
            ["saapadu"] = ("food", "Food", null),
            ["haal"] = ("rice", "Food", null),
            ["kiri"] = ("milk", "Food", null),
            ["gedara"] = ("house", "Shelter", null),
            ["wahala"] = ("roof", "Shelter", null),
            ["watura yata"] = ("flooded", "Search and Rescue", null),
            ["hirawela"] = ("trapped", "Search and Rescue", null),
            ["udaw"] = ("help", "Emergency", null),
            ["udavi"] = ("help", "Emergency", null),
            ["lamai"] = ("children", "Protection", null),
            ["podi"] = ("young / small", "Protection", null),
            ["babaa"] = ("baby", "Protection", null),
            ["kulandai"] = ("baby / child", "Protection", null),
            ["amma"] = ("mother", "Protection", null),
            ["thaththa"] = ("father", "Protection", null),
            ["achchi"] = ("elderly grandmother", "Medical", "elderly"),
            ["seeya"] = ("elderly grandfather", "Medical", "elderly"),
            ["naha"] = ("none / no", "General", null),
            ["na"] = ("no / none", "General", null),
            ["illai"] = ("no / none", "General", null),
            ["one"] = ("needed", "General", null),
            ["ona"] = ("needed", "General", null),
            ["venum"] = ("needed", "General", null),
            ["innawa"] = ("present / here", "General", null),
            ["ganga"] = ("river", "General", null),
            ["paara"] = ("road", "Transport", null),
        };

    private static readonly Dictionary<string, (string English, string NeedType, string? MedicalTerm)> UnicodeLexicon =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["වතුර"] = ("water", "Water", null),
            ["ජලය"] = ("water", "Water", null),
            ["බෙහෙත්"] = ("medicine", "Medical", "medicine"),
            ["ඉන්සියුලින්"] = ("insulin", "Medical", "insulin"),
            ["ආහාර"] = ("food", "Food", null),
            ["දරුවා"] = ("child / baby", "Protection", null),
            ["වැඩිහිටි"] = ("elderly", "Medical", "elderly"),
            ["හිරවෙලා"] = ("trapped", "Search and Rescue", null),
            ["අසාධ්‍ය"] = ("critical illness", "Medical", "critical"),
            ["ලේ ගලනවා"] = ("bleeding", "Medical", "bleeding"),
            ["තண்ணீர்"] = ("water", "Water", null),
            ["தண்ணீர்"] = ("water", "Water", null),
            ["நீர்"] = ("water", "Water", null),
            ["மருந்து"] = ("medicine", "Medical", "medicine"),
            ["இன்சுலின்"] = ("insulin", "Medical", "insulin"),
            ["உணவு"] = ("food", "Food", null),
            ["குழந்தை"] = ("child / baby", "Protection", null),
            ["முதியவர்"] = ("elderly", "Medical", "elderly"),
            ["சிக்கியுள்ளனர்"] = ("trapped", "Search and Rescue", null),
            ["உயிராபத்து"] = ("life-threatening emergency", "Medical", "critical"),
        };

    public GroqMultilingualNluService(
        HttpClient http,
        IConfiguration config,
        ILogger<GroqMultilingualNluService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<NluNormalizationResult> NormalizeAsync(
        string rawText,
        string? declaredLanguage = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return FallbackNormalize(string.Empty, declaredLanguage);
        }

        // Always redact PII before sending anything to Groq
        var redacted = PiiRedactor.Redact(rawText);
        var apiKey = _config["Groq:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return FallbackNormalize(redacted, declaredLanguage);
        }

        try
        {
            var modelId = _config["Groq:Model"] ?? "openai/gpt-oss-20b";
            var systemPrompt = $$"""
You are AEGIS-NLU ({{PromptVersion}}) for Sri Lankan humanitarian crisis triage.
Analyze citizen messages written in English, Sinhala, Tamil, Singlish (Sinhala/Tamil typed in Latin letters), or mixed text.
Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "detectedLanguage": "en|si|ta|singlish|mixed",
  "normalizedText": "normalized message in original script where possible",
  "englishText": "clear accurate English translation",
  "extracted": {
    "needType": "Water|Food|Medical|Shelter|Protection|Sanitation|Transport|Search and Rescue|General",
    "peopleCount": 1,
    "locationHints": ["place names"],
    "medicalTerms": ["medical terms if any"]
  },
  "confidence": 0.90
}
""";

            using var req = new HttpRequestMessage(HttpMethod.Post, GroqEndpoint);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            req.Content = JsonContent.Create(new
            {
                model = modelId,
                temperature = 0.1,
                max_tokens = 450,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = $"Declared language: {declaredLanguage ?? "auto"}\nMessage: {redacted}" }
                }
            });

            using var res = await _http.SendAsync(req, cancellationToken);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("Groq NLU returned HTTP {StatusCode}. Falling back to local transliteration engine.", (int)res.StatusCode);
                return FallbackNormalize(redacted, declaredLanguage);
            }

            var rawBody = await res.Content.ReadAsStringAsync(cancellationToken);
            if (TryParseGroqResponse(rawBody, modelId, out var parsed))
            {
                return parsed;
            }

            _logger.LogWarning("Groq NLU returned invalid JSON schema. Falling back to local transliteration engine.");
            return FallbackNormalize(redacted, declaredLanguage);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Groq NLU call failed. Falling back to local transliteration engine.");
            return FallbackNormalize(redacted, declaredLanguage);
        }
    }

    public static bool TryParseGroqResponse(string rawApiResponse, string modelId, out NluNormalizationResult result)
    {
        result = null!;
        try
        {
            using var doc = JsonDocument.Parse(rawApiResponse);
            if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
                return false;

            var content = choices[0].GetProperty("message").GetProperty("content").GetString();
            if (string.IsNullOrWhiteSpace(content))
                return false;

            // Strip optional markdown code fence if model emits one
            var json = content.Trim();
            if (json.StartsWith("```"))
            {
                var firstNewline = json.IndexOf('\n');
                var lastFence = json.LastIndexOf("```", StringComparison.Ordinal);
                if (firstNewline > 0 && lastFence > firstNewline)
                {
                    json = json[(firstNewline + 1)..lastFence].Trim();
                }
            }

            using var nluDoc = JsonDocument.Parse(json);
            var root = nluDoc.RootElement;

            var detectedLanguage = root.TryGetProperty("detectedLanguage", out var dl) ? dl.GetString()?.Trim().ToLowerInvariant() : null;
            var normalizedText = root.TryGetProperty("normalizedText", out var nt) ? nt.GetString()?.Trim() : null;
            var englishText = root.TryGetProperty("englishText", out var et) ? et.GetString()?.Trim() : null;

            if (string.IsNullOrWhiteSpace(detectedLanguage) || string.IsNullOrWhiteSpace(englishText))
                return false;

            if (detectedLanguage is not ("en" or "si" or "ta" or "singlish" or "mixed"))
                detectedLanguage = "mixed";

            var confidence = root.TryGetProperty("confidence", out var cf) && cf.ValueKind == JsonValueKind.Number
                ? Math.Clamp(cf.GetDouble(), 0.0, 1.0)
                : 0.80;

            var needType = "General";
            int? peopleCount = null;
            var locationHints = new List<string>();
            var medicalTerms = new List<string>();

            if (root.TryGetProperty("extracted", out var ext) && ext.ValueKind == JsonValueKind.Object)
            {
                if (ext.TryGetProperty("needType", out var needProp) && needProp.ValueKind == JsonValueKind.String)
                    needType = needProp.GetString() ?? "General";
                if (ext.TryGetProperty("peopleCount", out var pplProp) && pplProp.ValueKind == JsonValueKind.Number && pplProp.TryGetInt32(out var ppl))
                    peopleCount = Math.Clamp(ppl, 1, 500);
                if (ext.TryGetProperty("locationHints", out var locProp) && locProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in locProp.EnumerateArray())
                    {
                        var val = item.GetString();
                        if (!string.IsNullOrWhiteSpace(val)) locationHints.Add(val.Trim());
                    }
                }
                if (ext.TryGetProperty("medicalTerms", out var medProp) && medProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in medProp.EnumerateArray())
                    {
                        var val = item.GetString();
                        if (!string.IsNullOrWhiteSpace(val)) medicalTerms.Add(val.Trim());
                    }
                }
            }

            result = new NluNormalizationResult(
                detectedLanguage,
                string.IsNullOrWhiteSpace(normalizedText) ? englishText : normalizedText,
                englishText,
                new NluExtractedFields(needType, peopleCount, locationHints, medicalTerms),
                Math.Round(confidence, 2),
                $"Groq ({modelId})",
                PromptVersion,
                UsedFallback: false
            );
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static NluNormalizationResult FallbackNormalize(string redactedText, string? declaredLanguage)
    {
        var text = redactedText.Trim();
        var hasSinhala = text.Any(c => c >= '\u0D80' && c <= '\u0DFF');
        var hasTamil = text.Any(c => c >= '\u0B80' && c <= '\u0BFF');
        var hasLatin = text.Any(c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));

        var tokens = Regex.Split(text, @"[^\p{L}\p{N}]+")
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .ToList();

        var singlishMatches = new List<(string Token, string English, string NeedType, string? Medical)>();
        var unicodeMatches = new List<(string Token, string English, string NeedType, string? Medical)>();

        foreach (var token in tokens)
        {
            if (SinglishLexicon.TryGetValue(token, out var sMatch))
                singlishMatches.Add((token, sMatch.English, sMatch.NeedType, sMatch.MedicalTerm));
        }

        foreach (var kv in UnicodeLexicon)
        {
            if (text.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                unicodeMatches.Add((kv.Key, kv.Value.English, kv.Value.NeedType, kv.Value.MedicalTerm));
        }

        string detectedLanguage;
        if ((hasSinhala || hasTamil) && (hasLatin || singlishMatches.Count > 0))
            detectedLanguage = "mixed";
        else if (hasSinhala)
            detectedLanguage = "si";
        else if (hasTamil)
            detectedLanguage = "ta";
        else if (singlishMatches.Count > 0)
            detectedLanguage = "singlish";
        else
            detectedLanguage = string.IsNullOrWhiteSpace(declaredLanguage) ? "en" : declaredLanguage.ToLowerInvariant();

        var medicalTerms = singlishMatches.Select(m => m.Medical)
            .Concat(unicodeMatches.Select(m => m.Medical))
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var needType = singlishMatches.Select(m => m.NeedType)
            .Concat(unicodeMatches.Select(m => m.NeedType))
            .FirstOrDefault(n => n != "General") ?? "General";

        int? peopleCount = null;
        var numMatch = Regex.Match(text, @"\b(\d{1,3})\b");
        if (numMatch.Success && int.TryParse(numMatch.Groups[1].Value, out var parsedPeople) && parsedPeople is >= 1 and <= 500)
        {
            peopleCount = parsedPeople;
        }

        string englishText;
        if (detectedLanguage == "en")
        {
            englishText = text;
        }
        else
        {
            var translatedWords = tokens.Select(tok =>
            {
                if (SinglishLexicon.TryGetValue(tok, out var sm)) return sm.English;
                if (UnicodeLexicon.TryGetValue(tok, out var um)) return um.English;
                return tok;
            }).ToList();

            var joined = string.Join(" ", translatedWords);
            englishText = string.IsNullOrWhiteSpace(joined) ? text : joined;
            if (unicodeMatches.Count > 0 && translatedWords.SequenceEqual(tokens))
            {
                englishText = string.Join("; ", unicodeMatches.Select(u => u.English).Distinct());
            }
        }

        var totalSignals = singlishMatches.Count + unicodeMatches.Count;
        var confidence = detectedLanguage == "en"
            ? 0.85
            : Math.Clamp(0.55 + totalSignals * 0.08, 0.55, 0.88);

        return new NluNormalizationResult(
            detectedLanguage,
            text,
            englishText,
            new NluExtractedFields(needType, peopleCount, Array.Empty<string>(), medicalTerms),
            Math.Round(confidence, 2),
            "KeywordTransliterationFallback",
            PromptVersion,
            UsedFallback: true
        );
    }
}

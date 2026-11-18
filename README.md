# AEGIS — Humanitarian Crisis & Disaster Response Platform

**AEGIS** is a full-stack humanitarian crisis coordination platform built for Sri Lanka's 25 districts. It connects affected citizens with emergency relief coordinators using multilingual AI intake, real-time distress detection, deterministic predictive analytics, and Google OR-Tools route optimisation — under one core principle:

> **AI only recommends, drafts, or flags. Named human coordinators always decide, approve, send, and publish.**

---

## System Architecture

| Layer | Technology | Location |
| --- | --- | --- |
| **Frontend** | Next.js 15, React, TypeScript | `./src` |
| **Backend API** | C# ASP.NET Core (.NET 10) Web API | `./aegis-api` |
| **Database** | Supabase PostgreSQL (EF Core + Npgsql) | `AegisDbContext` |
| **LLM / NLU** | Groq (`openai/gpt-oss-20b`, API-only) | `GroqMultilingualNluService`, `GroqDistressDetectionService`, `AiCopilotService` |
| **Route Optimisation** | Google OR-Tools (`Google.OrTools 9.15.6755`) + Google Routes `computeRouteMatrix` | `OrToolsDispatchOptimiser` |
| **Weather & Flood Data** | Open-Meteo Forecast & Flood APIs | `PredictionService` |

### Clean Architecture & OOP Design (`aegis-api/src`)
- **`Aegis.Domain`** — Entities inheriting `BaseEntity` (`AssistanceRequest`, `Vehicle`, `DispatchPlan`, `AiGovernanceConfig`, `StockForecastSnapshot`, `DistrictRiskSnapshot`, `AuditLogEntry`) and domain enums.
- **`Aegis.Application`** — Interfaces (`IAiProvider`, `IMultilingualNluService`, `IAiGovernanceService`, `IDistressDetectionService`, `IAiCopilotService`, `IPredictionService`, `IDispatchOptimiser`, `IAllocationStrategy`) and DTOs.
- **`Aegis.Infrastructure`** — EF Core persistence, PostgreSQL migrations, Groq/Open-Meteo/OR-Tools services, `PiiRedactor`, `AiRateLimiter`, and `NotificationOutboxWorker` (`BackgroundService`).
- **`Aegis.Api`** — REST controllers (`RequestsController`, `AiGovernanceController`, `AiCopilotController`, `DispatchController`) with Dependency Injection and JWT/cookie role-based authorisation.

**Design Patterns:** Strategy (`IAllocationStrategy`, `IDispatchOptimiser`), Repository & Unit of Work (`IRepository<T>`, `IUnitOfWork`), Factory & Outbox (`NotificationFactory` + `NotificationOutboxWorker`), and Cryptographic Hash-Chained Audit Log (`AuditService`).

---

## Key Capabilities

### 1. Citizen Portal (`(citizen)`)
- **Full-Screen Request Studio (`/request`)**: Submit requests in English, Sinhala, Tamil, or Singlish with GPS coordinates and file evidence.
- **Live Case Tracking (`/my-requests`)**: 5-stage pipeline (`Submitted → Under review → Approved → On the way → Completed`) and timeline details.
- **Direct Coordinator Chat (`/chat`) & Preparedness Assistant (`/assistant`)**: Trilingual AI preparedness guidance restricted strictly to Sri Lanka disaster-relief and AEGIS topics.

### 2. Advanced AI — Part A: Multilingual NLU & AI Governance
- **Multilingual Normalisation**: Versioned prompt (`aegis-nlp-v3.0`) extracts `{detectedLanguage, normalizedText, englishText, extracted, confidence}` while keeping the citizen's original text untouched and redacting NICs, phones, and emails via `PiiRedactor`. Falls back to a deterministic keyword/transliteration engine if Groq fails.
- **AI Governance (`/admin/ai`)**: `SystemAdmin` can switch modes (**Active**, **Shadow**, **Off** kill switch) and configure confidence & fairness thresholds with mandatory audit reasons. Includes override analytics (`GET /api/v1/admin/ai/analytics`), calibration buckets, fairness checks, and deterministic counterfactual rationales.

### 3. Advanced AI — Part B: Distress Detection & Staff Copilot
- **Chat Distress Detection**: Rule-based + Groq classification (`none | elevated | high`) on citizen chat messages. High distress raises the request priority floor to `Critical`, publishes an SSE signal, and requires staff acknowledgement in `/admin/chat`.
- **Staff Copilot (`/api/v1/ai`)**:
  - 3–5 bullet **Chat Summary** & **Suggested Reply** (`Use` / `Edit` / `Dismiss`, audited as `"sent with AI draft"`, never auto-sent).
  - **Shift Handover** scoped strictly to the staff member's permitted requests and unacknowledged distress alerts.
  - **Natural-Language Search (`/admin/requests`)** validated against `NlSearchFilterWhitelist` (rejects unknown fields & SQL injection) with removable filter chips.
  - **Daily Situation Report Drafts (`/admin/reports`)** built from database aggregates and stored weather snapshots; humans edit, approve, and publish.

### 4. Advanced AI — Part C: Predictive Analytics
- **Stock Depletion Forecast (`GET /api/v1/ai/forecast/stock`)**: EWMA consumption rate + min/max range + configurable high-rainfall multiplier (`"not enough data"` when below minimum allocation points), displayed on `/admin/resources` and `/admin`.
- **District Risk Index (`GET /api/v1/ai/risk/districts`)**: Combines Open-Meteo 24h/72h rainfall, river discharge, active staff `OfficialAlerts`, and open-request density into `Low | Medium | High | Severe`, rendered on `/admin/map` with a factor drawer, `"advisory, not official"` label, and stale-data warnings.

### 5. Advanced AI — Part D: Google OR-Tools Dispatch Optimisation
- **Vehicle Fleet (`/admin/dispatch`)**: Staff register real vehicles (`Vehicle` entity); zero seeded vehicles.
- **Preview & Approval**: `OrToolsDispatchOptimiser` (`POST /api/v1/dispatch/plan`) computes capacity-constrained, priority-weighted routes with soft time windows, size caps (`50` stops / `15` vehicles), Google Routes `computeRouteMatrix` (with `"Haversine (estimated)"` fallback), and nearest-vehicle baseline savings. Only `POST /api/v1/dispatch/plans/{id}/approve` (with second approver for Critical stops) creates `VolunteerAssignment`s, queues notifications, and seals the audit log.

---

## Local Setup & Running

### Prerequisites
- .NET 10 SDK
- Node.js 20+ & npm
- Supabase PostgreSQL connection string

### 1. Backend API (`aegis-api`)
Configure secrets using `dotnet user-secrets` (never commit secrets):
```powershell
cd aegis-api/src/Aegis.Api
dotnet user-secrets set "ConnectionStrings:Default" "<your-supabase-session-pooler-connection-string>"
dotnet user-secrets set "Jwt:Key" "<strong-32+-char-jwt-secret>"
dotnet user-secrets set "NicCrypto:EncryptionKey" "<base64-32-byte-key>"
dotnet user-secrets set "NicCrypto:HmacKey" "<base64-32-byte-hmac-key>"
dotnet user-secrets set "Groq:ApiKey" "<your-groq-api-key>"
dotnet user-secrets set "GoogleMaps:ApiKey" "<optional-google-routes-key>"
```
Apply EF Core migrations, bootstrap the initial `SystemAdmin` (one-time on an empty database), and run the API:
```powershell
dotnet ef database update --project aegis-api/src/Aegis.Infrastructure --startup-project aegis-api/src/Aegis.Api
dotnet run --project aegis-api/src/Aegis.Api -- bootstrap-admin --email admin@yourdomain.org --full-name "System Admin"
dotnet run --project aegis-api/src/Aegis.Api
```

### 2. Frontend (`aegis-next`)
Configure `.env.local` (based on `.env.example`):
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<optional-browser-maps-key>
```
Run the frontend:
```powershell
npm install
npm run dev
```

### Environment Variables Reference
- **Backend:** `ConnectionStrings__Default`, `Jwt__Key`, `NicCrypto__EncryptionKey`, `NicCrypto__HmacKey`, `Groq__ApiKey`, `Groq__Model`, `GoogleMaps__ApiKey`, `Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`, `Smtp__FromEmail`, `Channel__Secret`, `Cors__FrontendOrigin`.
- **Frontend:** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

---

## Honest Known Issues & Limitations
- **Single-Instance In-Memory Signals & Rate Limits:** `InMemoryRealtimeSignalPublisher` (SSE) and `AiRateLimiter` run in-process; horizontal multi-replica scaling requires adding a Redis backplane.
- **Local Evidence Storage:** `LocalFileStorage` writes uploaded evidence under `App_Data/evidence`, which is ephemeral on stateless containers unless mounted to a persistent volume or replaced with object storage.
- **External API Fallbacks:** When `Groq:ApiKey`, `GoogleMaps:ApiKey`, or Open-Meteo are unconfigured or unreachable, AEGIS degrades gracefully to deterministic rule/keyword engines, Haversine (`"estimated"`) routing, and stored `WeatherSnapshot`s (flagged `IsStale` when outdated).
- **Pre-existing Lint Warning:** `src/app/(admin)/admin/shelters/page.tsx` has an unused `setAccessibilityTags` state setter warning during `next build`.

---

## Verification & Testing
- **Backend Unit Tests (64 tests across Parts A–D and core flows):**
  ```powershell
  dotnet test aegis-api/tests/Aegis.UnitTests/Aegis.UnitTests.csproj
  ```
- **Frontend Typecheck & Production Build:**
  ```powershell
  npm run typecheck
  npm run build
  ```

---

## Deployment & Presentation Docs
- Deployment & Docker OR-Tools (`libgomp1` / Debian glibc) notes: [`docs/deploy.md`](docs/deploy.md)
- 10-minute Group Presentation Script (PDF): [`docs/AEGIS_Presentation_Script.pdf`](docs/AEGIS_Presentation_Script.pdf)

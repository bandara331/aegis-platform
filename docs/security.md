# AEGIS Security Architecture & Threat Model

## 1. Authentication & Token Architecture
- **ASP.NET Core Identity**: Stored in schema `aegis` (`aegis.users`, `aegis.roles`, `aegis.user_roles`). Password policy requires minimum 8 characters and digits; lockout engages for 10 minutes after 5 failed attempts.
- **Short-Lived JWT + Rotating Refresh Tokens**:
  - Access tokens expire in **15 minutes** (`HS256`, signed with `Jwt:Key`, carrying `sub`, `email`, `fullName`, `orgId`, and `role` claims).
  - Refresh tokens are 64-byte cryptographic random values stored **only as SHA-256 hashes** in `aegis.refresh_tokens` and rotated on every use.
- **Next.js `httpOnly` Cookie Proxy**:
  - When logging in via the Next.js frontend, `/api/auth/login` sets the JWT in an `httpOnly`, `SameSite=Lax` cookie (`aegis_token`), preventing XSS token theft from `localStorage`.

---

## 2. Role x Endpoint Authorisation Matrix (9 Roles)

| Endpoint / Operation | Citizen | EmergencyCoord | CaseManager | LogisticsMgr | ShelterAdmin | VolunteerCoord | DonorOfficer | PartnerOfficer | SystemAdmin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `POST /api/v1/auth/register` | Public (creates Citizen only) | — | — | — | — | — | — | — | — |
| `POST /api/v1/requests` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/requests/{id}` | Own only | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/cases` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/v1/ai/recommendations/{id}/decision` | ✗ (`403`) | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `POST /api/v1/shelters/{id}/allocate` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/v1/resources/{id}/allocate` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/v1/scenarios/shortage` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/v1/volunteers/match & assign` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/donations?flaggedOnly=true` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/audit & /audit/verify` | ✗ (`403`) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `POST /api/v1/admin/simulate-outage` | ✗ (`403`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 3. Key Security & Governance Controls
1. **Two-Person Integrity Rule (Four-Eyes Principle)**: Critical decisions (critical priority or medical dispatches) require a non-empty `SecondApproverId` that differs from `DecidedById`, enforced in both `DecisionService` and PostgreSQL `CHECK (second_approver_id IS NULL OR second_approver_id <> decided_by_id)`.
2. **Cryptographic Tamper-Evident Audit Chain**: Every state-changing operation appends to `aegis.audit_log_entries` with `CurrentHash = SHA256(PreviousHash|SequenceNumber|EntityName|EntityId|Action|ActorId|TimestampUtc|DetailsJson)`, serialized via `pg_advisory_xact_lock(727274)` and protected by `BEFORE UPDATE/DELETE/TRUNCATE` triggers.
3. **Strict File Upload Validation (`LocalFileStorage`)**: Checks extension (`.jpg`, `.jpeg`, `.png`, `.pdf`), MIME type, size (`<= 5 MB`), and **binary magic bytes** (`FF D8 FF`, `89 50 4E 47`, `%PDF`), saving outside `wwwroot` (`App_Data/evidence`) with a random GUID filename and recording the SHA-256 file digest.
4. **Rate Limiting, Idempotency & Headers**: Fixed-window rate limiters guard `/auth/*` (10 req/min) and `POST /requests` (20 req/min); `Idempotency-Key` prevents duplicate submissions; responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Content-Security-Policy`.
5. **No PII in Logs**: Serilog structured logs record tracking numbers, entity IDs, and actor IDs without dumping personal phone numbers or raw descriptions.

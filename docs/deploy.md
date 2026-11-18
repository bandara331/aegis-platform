# AEGIS Deployment Guide

## 1. Frontend Deployment (Vercel)
1. Push the repository to GitHub and import the root project (`.`) into **Vercel**.
2. Set the following Environment Variables in the Vercel project settings:
   - `NEXT_PUBLIC_API_BASE_URL=https://<your-api-host>/api/v1`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-browser-key>`
3. Deploy. Next.js middleware and `/api/*` route handlers run server-side and store the JWT inside an `httpOnly`, `SameSite=Lax` cookie (`aegis_token`).

### Restrict Google Browser Key Referrers
In **Google Cloud Console → Credentials → Browser API Key → Application restrictions**:
- Select **Websites (HTTP referrers)** and allow only your production domain(s):
  - `https://<your-vercel-domain>.vercel.app/*`
  - `https://<your-custom-domain>/*` (if applicable)
- Restrict **API restrictions** to **Maps JavaScript API** only. Keep **Routes API** on a separate server-side key (`GoogleMaps:ApiKey` / `GoogleRoutes:ApiKey`).

---

## 2. Backend API Deployment (Docker on Render or Azure App Service)
A multi-stage `Dockerfile` is provided at `./aegis-api/Dockerfile` using Debian-based `mcr.microsoft.com/dotnet/aspnet:10.0`.

### Google OR-Tools Native Libraries in Docker
- `Google.OrTools` (`9.15.6755`) ships platform-specific native binaries (`libortools.so` for `linux-x64` / `linux-arm64`).
- `aegis-api/Dockerfile` uses Debian (glibc) rather than Alpine/musl and installs `libgomp1` so OR-Tools native shared libraries load cleanly at runtime.
- When building on Apple Silicon for `linux-x64` cloud hosts, pass `--platform linux/amd64` to `docker build`.

### Supabase Session Pooler Connection String
Most container hosts (Render, Azure App Service, Railway) provide **IPv4-only** egress by default. Always configure `ConnectionStrings__Default` using the **Supabase Session Pooler** (`aws-0-<region>.pooler.supabase.com`, port `5432`) rather than the IPv6-only direct host:
```text
Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
```

### Host Secrets (Configure in Render / Azure App Service Environment Variables — Never Commit)
| Variable | Purpose |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__Default` | Supabase Session Pooler PostgreSQL URI |
| `Jwt__Key` | 32+ byte cryptographic signing secret for access tokens |
| `NicCrypto__EncryptionKey` | Base64 32-byte AES-256-GCM key for citizen NIC encryption |
| `NicCrypto__HmacKey` | Base64 32-byte HMAC-SHA256 key for NIC blind-index lookups |
| `Groq__ApiKey` | Groq API key (server-side only) |
| `Groq__Model` | Optional model override (default `openai/gpt-oss-20b`) |
| `GoogleMaps__ApiKey` | Server-side Google Routes `computeRouteMatrix` / `computeRoutes` key |
| `Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`, `Smtp__FromEmail` | Outbox email delivery credentials (OTP, invites, status updates) |
| `Channel__Secret` | Webhook / realtime channel signing secret |
| `Cors__FrontendOrigin` | Exact Vercel origin (`https://<your-vercel-domain>.vercel.app`) |

### CORS Configuration
Set `Cors__FrontendOrigin` on the API host to the exact production frontend origin (no trailing slash). The API rejects cross-origin browser requests from unlisted origins.

---

## 3. Initial Admin Bootstrap (Clean Database)
On a fresh PostgreSQL database with migrations applied (`dotnet ef database update`), create the single initial `SystemAdmin` via console CLI:
```bash
dotnet run --project src/Aegis.Api -- bootstrap-admin --email admin@yourdomain.org --full-name "System Admin"
```
It prompts interactively for the password, refuses to run if any `SystemAdmin` already exists, and records a `BootstrapAdmin` audit entry. From there, log in and invite other staff via `/admin/users`.

---

## 4. Production Hardening Checklist
- [ ] **Supabase RLS Hardening:** Enable Row-Level Security (`ALTER TABLE aegis.<table> ENABLE ROW LEVEL SECURITY;`) on all `aegis.*` tables so direct PostgREST/anon-key client access is blocked by default while the backend EF Core role accesses via least-privilege credentials.
- [ ] **Automated Backups & PITR:** Enable Supabase daily automated backups and Point-in-Time Recovery (PITR); test restore to a staging project before go-live.
- [ ] **Key Rotation Policy:** Rotate `Jwt__Key`, `Groq__ApiKey`, `GoogleMaps__ApiKey`, `Smtp__Password`, and `Channel__Secret` every 90 days; plan dual-key re-encryption window before rotating `NicCrypto__EncryptionKey`.
- [ ] **Budget & Quota Alerts:** Configure billing caps and 50%/80%/100% alerts in Groq Console, Google Cloud Billing (Maps + Routes), Supabase, and Render/Azure/Vercel.
- [ ] **Persistent Evidence Storage:** Mount a persistent volume to `App_Data/evidence` (or replace `LocalFileStorage` with S3/Supabase Storage) if deploying on ephemeral containers.

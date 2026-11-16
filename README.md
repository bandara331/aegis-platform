# AEGIS — Humanitarian Crisis Coordination Platform (SE205.3)

**AI advises. Named humans decide. Every step is on the record.**

## Repository Structure
- `./` (Next.js 15 + React 19 Frontend — Live API client, Skeleton/EmptyState/ErrorState handling)
- `./aegis-api` (.NET 10 C# ASP.NET Core Web API Backend — Clean Architecture in `Aegis.sln`)
- `./scripts/reset-aegis-schema.sql` (Destructive schema reset script for development resets)
- `./docs` (Architecture, Database, Security, Deployment, Mermaid Diagrams, and Postman Collection)

---

## 1. Supabase PostgreSQL Setup (Session vs Transaction Pooler)
AEGIS uses **Supabase ONLY as managed PostgreSQL**, reached via Npgsql/EF Core in a dedicated schema `"aegis"`. No Supabase Auth, PostgREST Data API, or `supabase-js` keys are used.

- **Use the Session Pooler (IPv4, Port `5432`)** for both the application and EF Core migrations because the direct connection (`db.<ref>.supabase.co:5432`) is IPv6-only on many networks.
- **Note on Transaction Pooler (Port `6543`)**: PgBouncer transaction pooling requires Npgsql settings `No Reset On Close=true;Max Auto Prepare=0` and **must not** be used for EF Core migrations.

### Configure the Database Connection String in `dotnet user-secrets`
From the repository root:
```powershell
dotnet user-secrets set "ConnectionStrings:Default" "Host=<pooler-host>;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<your-db-password>;SSL Mode=Require;Trust Server Certificate=true" --project "aegis-api/src/Aegis.Api"
```

### Apply EF Core Migrations to Supabase
The system starts **empty** with zero demo data. Migrations seed **only** reference data: the 9 RBAC roles, 8 request categories, and Sri Lanka's 9 provinces and 25 districts (names only).
```powershell
cd aegis-api
dotnet ef database update -p src/Aegis.Infrastructure -s src/Aegis.Api
```

### Resetting the Schema (`scripts/reset-aegis-schema.sql`)
To wipe the `aegis` schema completely (`DROP SCHEMA IF EXISTS aegis CASCADE;`) and re-apply migrations from scratch:
1. Run `scripts/reset-aegis-schema.sql` in the Supabase SQL Editor (or via `dotnet ef database drop -f -p src/Aegis.Infrastructure -s src/Aegis.Api`).
2. Re-run `dotnet ef database update -p src/Aegis.Infrastructure -s src/Aegis.Api`.

---

## 2. Bootstrapping the First Administrator (`bootstrap-admin`)
Because no demo accounts are seeded, create the initial `SystemAdmin` via the console command:
```powershell
cd aegis-api
dotnet run --project src/Aegis.Api -- bootstrap-admin --email admin@yourdomain.org
```
- **Security**: Prompts interactively for the password (`ReadKey(intercept: true)`). Passing `--password` on the command line is rejected, and the password is never logged.
- **One-Time Guard**: Refuses to run if a `SystemAdmin` already exists in the database.
- **Auditability**: Appends a `BootstrapAdmin` entry to the SHA-256 cryptographic audit chain.

---

## 3. Running the Backend & Frontend
### Backend API (.NET 10)
```powershell
cd aegis-api
dotnet run --project src/Aegis.Api --urls http://localhost:5000
```
- **Swagger UI**: `http://localhost:5000/swagger`
- **Public Stats**: `http://localhost:5000/api/v1/public/stats`
- **Reference Metadata**: `http://localhost:5000/api/v1/reference/metadata`

### Frontend (Next.js 15)
1. Copy `.env.example` to `.env.local` (`NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1`).
2. Start Next.js:
```powershell
npm run dev
```

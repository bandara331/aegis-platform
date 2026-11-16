# AEGIS Deployment Guide

## 1. Frontend Deployment (Vercel)
1. Push the repository to GitHub and import the root project into **Vercel**.
2. Set the following Environment Variables in the Vercel dashboard:
   - `NEXT_PUBLIC_API_MODE=live` (or `mock` for standalone static preview)
   - `NEXT_PUBLIC_API_BASE_URL=https://<your-api-host>/api/v1`
3. Deploy. Next.js middleware and `/api/*` route handlers run as serverless functions, keeping the JWT inside an `httpOnly` cookie.

---

## 2. Backend API Deployment (Docker on Render / Azure App Service / Local Demo)
A multi-stage `Dockerfile` is provided at `./aegis-api/Dockerfile`.

### Build and Run Locally with Docker
```powershell
cd aegis-api
docker build -t aegis-api:latest .
docker run -p 5000:8080 `
  -e ASPNETCORE_ENVIRONMENT=Development `
  -e "ConnectionStrings__Default=Host=aws-0-ap-southeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true" `
  -e "Cors__FrontendOrigin=http://localhost:3000" `
  aegis-api:latest
```

### Important Network Note for Cloud Hosts (Azure App Service / Render / Railway)
Most container hosts provide **IPv4-only** egress by default. Always configure `ConnectionStrings__Default` using the **Supabase Session Pooler** (`aws-0-<region>.pooler.supabase.com`, port `5432`) rather than the IPv6-only direct host.

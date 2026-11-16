# AEGIS Database Design & Supabase PostgreSQL Hardening

## 1. Why PostgreSQL on Supabase?
- **ACID Transactions & Row Locking**: Supports `SELECT ... FOR UPDATE` and transaction-scoped advisory locks (`pg_advisory_xact_lock`), preventing over-allocation of shelters/resources and serializing cryptographic audit chain appends.
- **Rich Data Types**: Native `timestamptz` (UTC), `uuid`, `jsonb` for structured AI feature scores and rationales, and the PostgreSQL `xmin` system column for zero-overhead optimistic concurrency control.
- **Managed Infrastructure**: Supabase provides a managed PostgreSQL 15+ instance with built-in IPv4 connection pooling.

---

## 2. Dedicated Schema `"aegis"` & Naming Convention
All tables reside in schema **`aegis`** (`builder.HasDefaultSchema("aegis")`) rather than `public`, using `EFCore.NamingConventions` (`UseSnakeCaseNamingConvention()`) so all table, column, index, and constraint names follow PostgreSQL `snake_case` standards.

---

## 3. Connection Modes: Session Pooler (5432) vs Transaction Pooler (6543)
- **Session Pooler (Port `5432`, IPv4) — Used by AEGIS**:
  - Format: `Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<secret>;SSL Mode=Require;Trust Server Certificate=true`
  - Required because Supabase's direct connection (`db.<project-ref>.supabase.co:5432`) is IPv6-only on many residential/campus networks. Session mode preserves session-level locks and prepared statements needed by EF Core migrations.
- **Transaction Pooler (Port `6543`)**:
  - Multiplexes transactions across backend connections. If used in high-concurrency read replicas, Npgsql must be configured with `No Reset On Close=true;Max Auto Prepare=0`, and it **must never** be used to run `dotnet ef database update`.

---

## 4. Database Integrity Constraints & Concurrency Control
Enforced in both C# domain logic and PostgreSQL DDL (`HardeningAndTriggers` migration):
1. **Shelter Capacity**: `CHECK (occupancy <= capacity)` on `aegis.shelters` + `xmin` optimistic concurrency token + `SELECT ... FOR UPDATE` row lock inside a transaction. Concurrent requests attempting to exceed capacity receive `HTTP 409 Conflict`.
2. **Resource Stock**: `CHECK (quantity_available >= 0)` on `aegis.resources` + `xmin` concurrency token + `SELECT ... FOR UPDATE`.
3. **Two-Person Rule**: `CHECK (second_approver_id IS NULL OR second_approver_id <> decided_by_id)` on `aegis.decisions`.
4. **Append-Only Audit Triggers**:
   - `trg_audit_no_update` (`BEFORE UPDATE ON aegis.audit_log_entries`)
   - `trg_audit_no_delete` (`BEFORE DELETE ON aegis.audit_log_entries`)
   - `trg_audit_no_truncate` (`BEFORE TRUNCATE ON aegis.audit_log_entries`)
   All three execute `aegis.fn_prevent_audit_tampering()`, which raises a PostgreSQL exception if any modification or deletion is attempted.

---

## 5. Supabase RLS Defence-in-Depth
Because Supabase projects expose a PostgREST Data API by default, the `HardeningAndTriggers` migration executes:
1. `ALTER TABLE aegis.<table> ENABLE ROW LEVEL SECURITY;` on every table in schema `aegis` with **zero permissive policies** (default-deny).
2. `REVOKE ALL ON SCHEMA aegis, ALL TABLES, ALL SEQUENCES, ALL ROUTINES FROM anon, authenticated;`
Only the C# ASP.NET Core Web API connecting over TLS as the backend role can read or mutate `aegis` tables.

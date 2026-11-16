using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HardeningAndTriggers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Database Integrity CHECK Constraints
            migrationBuilder.Sql(@"
                ALTER TABLE aegis.shelters 
                ADD CONSTRAINT ck_shelters_occupancy_le_capacity 
                CHECK (occupancy <= capacity);
            ");

            migrationBuilder.Sql(@"
                ALTER TABLE aegis.resources 
                ADD CONSTRAINT ck_resources_qty_available_nonneg 
                CHECK (quantity_available >= 0);
            ");

            migrationBuilder.Sql(@"
                ALTER TABLE aegis.decisions 
                ADD CONSTRAINT ck_decisions_second_approver_diff 
                CHECK (second_approver_id IS NULL OR second_approver_id <> decided_by_id);
            ");

            // 2. Tamper-evident Audit Triggers (Append-Only Enforcement)
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION aegis.fn_prevent_audit_tampering()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'AuditLogEntry is strictly append-only and cannot be updated or deleted.';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS trg_audit_no_update ON aegis.audit_log_entries;
                CREATE TRIGGER trg_audit_no_update
                BEFORE UPDATE ON aegis.audit_log_entries
                FOR EACH ROW EXECUTE FUNCTION aegis.fn_prevent_audit_tampering();

                DROP TRIGGER IF EXISTS trg_audit_no_delete ON aegis.audit_log_entries;
                CREATE TRIGGER trg_audit_no_delete
                BEFORE DELETE ON aegis.audit_log_entries
                FOR EACH ROW EXECUTE FUNCTION aegis.fn_prevent_audit_tampering();
            ");

            // 3. Supabase RLS Hardening & Privilege Revocation
            // Enable RLS on all tables in aegis schema with NO policies (defense in depth against anon/authenticated PostgREST)
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    t text;
                BEGIN
                    FOR t IN 
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'aegis' AND table_type = 'BASE TABLE'
                    LOOP
                        EXECUTE format('ALTER TABLE aegis.%I ENABLE ROW LEVEL SECURITY;', t);
                    END LOOP;
                END $$;

                REVOKE ALL ON SCHEMA aegis FROM anon, authenticated;
                REVOKE ALL ON ALL TABLES IN SCHEMA aegis FROM anon, authenticated;
                REVOKE ALL ON ALL SEQUENCES IN SCHEMA aegis FROM anon, authenticated;
                REVOKE ALL ON ALL ROUTINES IN SCHEMA aegis FROM anon, authenticated;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS trg_audit_no_update ON aegis.audit_log_entries;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS trg_audit_no_delete ON aegis.audit_log_entries;");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS aegis.fn_prevent_audit_tampering;");

            migrationBuilder.Sql("ALTER TABLE aegis.decisions DROP CONSTRAINT IF EXISTS ck_decisions_second_approver_diff;");
            migrationBuilder.Sql("ALTER TABLE aegis.resources DROP CONSTRAINT IF EXISTS ck_resources_qty_available_nonneg;");
            migrationBuilder.Sql("ALTER TABLE aegis.shelters DROP CONSTRAINT IF EXISTS ck_shelters_occupancy_le_capacity;");
        }
    }
}

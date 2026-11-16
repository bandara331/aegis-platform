using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AuditDetailsAsText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // jsonb normalises key order/whitespace, which changes the bytes that were hashed.
            // The audit payload must round-trip byte-for-byte, so it is stored as text.
            migrationBuilder.AlterColumn<string>(
                name: "details_json",
                schema: "aegis",
                table: "audit_log_entries",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "jsonb");

            // ONE-OFF pre-release reset. Entries written before this migration were hashed with
            // 100ns timestamps / pre-jsonb payloads and can never verify. Only throw-away smoke-test
            // rows exist at this point; the guard refuses to run if the log holds real volume.
            migrationBuilder.Sql(@"
                DO $$
                DECLARE n bigint;
                BEGIN
                    SELECT count(*) INTO n FROM aegis.audit_log_entries;
                    IF n > 50 THEN
                        RAISE EXCEPTION 'Refusing to reset audit log: % entries present (expected only dev smoke-test data).', n;
                    END IF;

                    ALTER TABLE aegis.audit_log_entries DISABLE TRIGGER trg_audit_no_delete;
                    DELETE FROM aegis.audit_log_entries;
                    ALTER TABLE aegis.audit_log_entries ENABLE TRIGGER trg_audit_no_delete;

                    DELETE FROM aegis.audit_chain_heads;
                END $$;
            ");

            // Close the gap in the original hardening: row-level triggers do not fire on TRUNCATE.
            migrationBuilder.Sql(@"
                DROP TRIGGER IF EXISTS trg_audit_no_truncate ON aegis.audit_log_entries;
                CREATE TRIGGER trg_audit_no_truncate
                BEFORE TRUNCATE ON aegis.audit_log_entries
                FOR EACH STATEMENT EXECUTE FUNCTION aegis.fn_prevent_audit_tampering();
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS trg_audit_no_truncate ON aegis.audit_log_entries;");

            migrationBuilder.AlterColumn<string>(
                name: "details_json",
                schema: "aegis",
                table: "audit_log_entries",
                type: "jsonb",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}

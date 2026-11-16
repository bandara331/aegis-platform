using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReferenceDataOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "districts",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    province_code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_districts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "provinces",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_provinces", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "request_categories",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_request_categories", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_districts_name",
                schema: "aegis",
                table: "districts",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_provinces_code",
                schema: "aegis",
                table: "provinces",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_request_categories_code",
                schema: "aegis",
                table: "request_categories",
                column: "code",
                unique: true);

            // RLS hardening on reference tables (no policies, revoke from anon/authenticated)
            migrationBuilder.Sql(@"
                ALTER TABLE aegis.provinces ENABLE ROW LEVEL SECURITY;
                ALTER TABLE aegis.districts ENABLE ROW LEVEL SECURITY;
                ALTER TABLE aegis.request_categories ENABLE ROW LEVEL SECURITY;
                REVOKE ALL ON aegis.provinces, aegis.districts, aegis.request_categories FROM anon, authenticated;
            ");

            // Purge any earlier development demo data so the system starts strictly empty
            migrationBuilder.Sql(@"
                ALTER TABLE aegis.audit_log_entries DISABLE TRIGGER trg_audit_no_delete;
                ALTER TABLE aegis.audit_log_entries DISABLE TRIGGER trg_audit_no_truncate;
                DELETE FROM aegis.audit_log_entries;
                DELETE FROM aegis.audit_chain_heads;
                ALTER TABLE aegis.audit_log_entries ENABLE TRIGGER trg_audit_no_delete;
                ALTER TABLE aegis.audit_log_entries ENABLE TRIGGER trg_audit_no_truncate;

                TRUNCATE TABLE
                    aegis.decisions,
                    aegis.ai_recommendations,
                    aegis.request_histories,
                    aegis.request_evidences,
                    aegis.shelter_allocations,
                    aegis.resource_allocations,
                    aegis.volunteer_assignments,
                    aegis.assistance_requests,
                    aegis.shelters,
                    aegis.resources,
                    aegis.volunteers,
                    aegis.donations,
                    aegis.campaigns,
                    aegis.operational_areas,
                    aegis.crises,
                    aegis.organisations,
                    aegis.notification_outboxes,
                    aegis.idempotency_records,
                    aegis.refresh_tokens,
                    aegis.user_roles,
                    aegis.user_claims,
                    aegis.user_logins,
                    aegis.user_tokens,
                    aegis.users
                RESTART IDENTITY CASCADE;
            ");

            // Reference Data 1: 9 RBAC Roles
            migrationBuilder.Sql(@"
                INSERT INTO aegis.roles (id, name, normalized_name, concurrency_stamp) VALUES
                    ('role-citizen', 'Citizen', 'CITIZEN', 'c1'),
                    ('role-emergency-coordinator', 'EmergencyCoordinator', 'EMERGENCYCOORDINATOR', 'c2'),
                    ('role-case-manager', 'CaseManager', 'CASEMANAGER', 'c3'),
                    ('role-logistics-manager', 'LogisticsManager', 'LOGISTICSMANAGER', 'c4'),
                    ('role-shelter-admin', 'ShelterAdmin', 'SHELTERADMIN', 'c5'),
                    ('role-volunteer-coordinator', 'VolunteerCoordinator', 'VOLUNTEERCOORDINATOR', 'c6'),
                    ('role-donor-officer', 'DonorOfficer', 'DONOROFFICER', 'c7'),
                    ('role-partner-officer', 'PartnerOfficer', 'PARTNEROFFICER', 'c8'),
                    ('role-system-admin', 'SystemAdmin', 'SYSTEMADMIN', 'c9')
                ON CONFLICT DO NOTHING;
            ");

            // Reference Data 2: Request Categories
            migrationBuilder.Sql(@"
                INSERT INTO aegis.request_categories (id, code, name, created_at, is_deleted) VALUES
                    ('10000000-0000-0000-0000-000000000001', 'MEDICAL', 'Medical', NOW(), false),
                    ('10000000-0000-0000-0000-000000000002', 'WATER', 'Water', NOW(), false),
                    ('10000000-0000-0000-0000-000000000003', 'FOOD', 'Food', NOW(), false),
                    ('10000000-0000-0000-0000-000000000004', 'SHELTER', 'Shelter', NOW(), false),
                    ('10000000-0000-0000-0000-000000000005', 'TRANSPORT', 'Transport', NOW(), false),
                    ('10000000-0000-0000-0000-000000000006', 'SANITATION', 'Sanitation', NOW(), false),
                    ('10000000-0000-0000-0000-000000000007', 'PROTECTION', 'Protection', NOW(), false),
                    ('10000000-0000-0000-0000-000000000008', 'SEARCH_RESCUE', 'Search and Rescue', NOW(), false)
                ON CONFLICT (code) DO NOTHING;
            ");

            // Reference Data 3: Sri Lanka's 9 Provinces (names only)
            migrationBuilder.Sql(@"
                INSERT INTO aegis.provinces (id, code, name, created_at, is_deleted) VALUES
                    ('20000000-0000-0000-0000-000000000001', 'WP', 'Western Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000002', 'CP', 'Central Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000003', 'SP', 'Southern Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000004', 'NP', 'Northern Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000005', 'EP', 'Eastern Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000006', 'NWP', 'North Western Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000007', 'NCP', 'North Central Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000008', 'UP', 'Uva Province', NOW(), false),
                    ('20000000-0000-0000-0000-000000000009', 'SGP', 'Sabaragamuwa Province', NOW(), false)
                ON CONFLICT (code) DO NOTHING;
            ");

            // Reference Data 4: Sri Lanka's 25 Districts (names only; coordinates come from geocoding)
            migrationBuilder.Sql(@"
                INSERT INTO aegis.districts (id, province_code, name, created_at, is_deleted) VALUES
                    ('30000000-0000-0000-0000-000000000001', 'WP', 'Colombo', NOW(), false),
                    ('30000000-0000-0000-0000-000000000002', 'WP', 'Gampaha', NOW(), false),
                    ('30000000-0000-0000-0000-000000000003', 'WP', 'Kalutara', NOW(), false),
                    ('30000000-0000-0000-0000-000000000004', 'CP', 'Kandy', NOW(), false),
                    ('30000000-0000-0000-0000-000000000005', 'CP', 'Matale', NOW(), false),
                    ('30000000-0000-0000-0000-000000000006', 'CP', 'Nuwara Eliya', NOW(), false),
                    ('30000000-0000-0000-0000-000000000007', 'SP', 'Galle', NOW(), false),
                    ('30000000-0000-0000-0000-000000000008', 'SP', 'Matara', NOW(), false),
                    ('30000000-0000-0000-0000-000000000009', 'SP', 'Hambantota', NOW(), false),
                    ('30000000-0000-0000-0000-000000000010', 'NP', 'Jaffna', NOW(), false),
                    ('30000000-0000-0000-0000-000000000011', 'NP', 'Kilinochchi', NOW(), false),
                    ('30000000-0000-0000-0000-000000000012', 'NP', 'Mannar', NOW(), false),
                    ('30000000-0000-0000-0000-000000000013', 'NP', 'Vavuniya', NOW(), false),
                    ('30000000-0000-0000-0000-000000000014', 'NP', 'Mullaitivu', NOW(), false),
                    ('30000000-0000-0000-0000-000000000015', 'EP', 'Batticaloa', NOW(), false),
                    ('30000000-0000-0000-0000-000000000016', 'EP', 'Ampara', NOW(), false),
                    ('30000000-0000-0000-0000-000000000017', 'EP', 'Trincomalee', NOW(), false),
                    ('30000000-0000-0000-0000-000000000018', 'NWP', 'Kurunegala', NOW(), false),
                    ('30000000-0000-0000-0000-000000000019', 'NWP', 'Puttalam', NOW(), false),
                    ('30000000-0000-0000-0000-000000000020', 'NCP', 'Anuradhapura', NOW(), false),
                    ('30000000-0000-0000-0000-000000000021', 'NCP', 'Polonnaruwa', NOW(), false),
                    ('30000000-0000-0000-0000-000000000022', 'UP', 'Badulla', NOW(), false),
                    ('30000000-0000-0000-0000-000000000023', 'UP', 'Moneragala', NOW(), false),
                    ('30000000-0000-0000-0000-000000000024', 'SGP', 'Ratnapura', NOW(), false),
                    ('30000000-0000-0000-0000-000000000025', 'SGP', 'Kegalle', NOW(), false)
                ON CONFLICT (name) DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "districts",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "provinces",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "request_categories",
                schema: "aegis");
        }
    }
}

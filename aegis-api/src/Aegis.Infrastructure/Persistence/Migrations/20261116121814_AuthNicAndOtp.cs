using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AuthNicAndOtp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "consent_given_at_utc",
                schema: "aegis",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_enabled",
                schema: "aegis",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "masked_nic",
                schema: "aegis",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nic_ciphertext",
                schema: "aegis",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nic_hmac",
                schema: "aegis",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "personal_data_consent",
                schema: "aegis",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "email_otp_challenges",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    purpose = table.Column<string>(type: "text", nullable: false),
                    code_hash = table.Column<string>(type: "text", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    max_attempts = table.Column<int>(type: "integer", nullable: false),
                    resend_available_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    consumed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_email_otp_challenges", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staff_invitations",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    full_name = table.Column<string>(type: "text", nullable: false),
                    role = table.Column<string>(type: "text", nullable: false),
                    preferred_language = table.Column<string>(type: "text", nullable: false),
                    token_hash = table.Column<string>(type: "text", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    accepted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    invited_by_id = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_staff_invitations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_users_nic_hmac",
                schema: "aegis",
                table: "users",
                column: "nic_hmac",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_email_otp_challenges_email_purpose",
                schema: "aegis",
                table: "email_otp_challenges",
                columns: new[] { "email", "purpose" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_invitations_token_hash",
                schema: "aegis",
                table: "staff_invitations",
                column: "token_hash",
                unique: true);

            migrationBuilder.Sql(@"
                ALTER TABLE aegis.email_otp_challenges ENABLE ROW LEVEL SECURITY;
                ALTER TABLE aegis.staff_invitations ENABLE ROW LEVEL SECURITY;
                REVOKE ALL ON aegis.email_otp_challenges, aegis.staff_invitations FROM anon, authenticated;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_otp_challenges",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "staff_invitations",
                schema: "aegis");

            migrationBuilder.DropIndex(
                name: "ix_users_nic_hmac",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "consent_given_at_utc",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_enabled",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "masked_nic",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "nic_ciphertext",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "nic_hmac",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "personal_data_consent",
                schema: "aegis",
                table: "users");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase5OperationsAndAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "district",
                schema: "aegis",
                table: "volunteers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "is_verified",
                schema: "aegis",
                table: "volunteers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "masked_nic",
                schema: "aegis",
                table: "volunteers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nic_ciphertext",
                schema: "aegis",
                table: "volunteers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "review_notes",
                schema: "aegis",
                table: "donations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "review_status",
                schema: "aegis",
                table: "donations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "reviewed_at_utc",
                schema: "aegis",
                table: "donations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reviewed_by_id",
                schema: "aegis",
                table: "donations",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "official_alerts",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    district = table.Column<string>(type: "text", nullable: false),
                    severity = table.Column<string>(type: "text", nullable: false),
                    language = table.Column<string>(type: "text", nullable: false),
                    issued_by_id = table.Column<string>(type: "text", nullable: false),
                    issued_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_expired = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_official_alerts", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "official_alerts",
                schema: "aegis");

            migrationBuilder.DropColumn(
                name: "district",
                schema: "aegis",
                table: "volunteers");

            migrationBuilder.DropColumn(
                name: "is_verified",
                schema: "aegis",
                table: "volunteers");

            migrationBuilder.DropColumn(
                name: "masked_nic",
                schema: "aegis",
                table: "volunteers");

            migrationBuilder.DropColumn(
                name: "nic_ciphertext",
                schema: "aegis",
                table: "volunteers");

            migrationBuilder.DropColumn(
                name: "review_notes",
                schema: "aegis",
                table: "donations");

            migrationBuilder.DropColumn(
                name: "review_status",
                schema: "aegis",
                table: "donations");

            migrationBuilder.DropColumn(
                name: "reviewed_at_utc",
                schema: "aegis",
                table: "donations");

            migrationBuilder.DropColumn(
                name: "reviewed_by_id",
                schema: "aegis",
                table: "donations");
        }
    }
}

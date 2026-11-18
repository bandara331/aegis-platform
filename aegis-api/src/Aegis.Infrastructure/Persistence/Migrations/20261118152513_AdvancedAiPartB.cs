using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedAiPartB : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "distress_acknowledged_at",
                schema: "aegis",
                table: "assistance_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "distress_acknowledged_by_id",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "distress_detected_at",
                schema: "aegis",
                table: "assistance_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "distress_flagged",
                schema: "aegis",
                table: "assistance_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "distress_level",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "distress_reason",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "situation_report_drafts",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    content_markdown = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    is_ai_assisted = table.Column<bool>(type: "boolean", nullable: false),
                    created_by_id = table.Column<string>(type: "text", nullable: false),
                    published_by_id = table.Column<string>(type: "text", nullable: true),
                    published_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_situation_report_drafts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "weather_snapshots",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    district = table.Column<string>(type: "text", nullable: false),
                    summary = table.Column<string>(type: "text", nullable: false),
                    temperature_c = table.Column<double>(type: "double precision", nullable: true),
                    precipitation_mm = table.Column<double>(type: "double precision", nullable: true),
                    wind_kph = table.Column<double>(type: "double precision", nullable: true),
                    severity = table.Column<string>(type: "text", nullable: false),
                    observed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weather_snapshots", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "situation_report_drafts",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "weather_snapshots",
                schema: "aegis");

            migrationBuilder.DropColumn(
                name: "distress_acknowledged_at",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "distress_acknowledged_by_id",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "distress_detected_at",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "distress_flagged",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "distress_level",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "distress_reason",
                schema: "aegis",
                table: "assistance_requests");
        }
    }
}

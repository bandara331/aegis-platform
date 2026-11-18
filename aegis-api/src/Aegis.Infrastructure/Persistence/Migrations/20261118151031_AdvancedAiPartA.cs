using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedAiPartA : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ai_translated",
                schema: "aegis",
                table: "assistance_requests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "detected_language",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "english_text",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "extracted_json",
                schema: "aegis",
                table: "assistance_requests",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "language_confidence",
                schema: "aegis",
                table: "assistance_requests",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "normalized_text",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "below_threshold",
                schema: "aegis",
                table: "ai_recommendations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "counterfactual_note",
                schema: "aegis",
                table: "ai_recommendations",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "is_shadow",
                schema: "aegis",
                table: "ai_recommendations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "prompt_version",
                schema: "aegis",
                table: "ai_recommendations",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ai_governance_configs",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mode = table.Column<string>(type: "text", nullable: false),
                    confidence_threshold = table.Column<double>(type: "double precision", nullable: false),
                    fairness_disparity_threshold = table.Column<double>(type: "double precision", nullable: false),
                    updated_by_id = table.Column<string>(type: "text", nullable: false),
                    updated_reason = table.Column<string>(type: "text", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_governance_configs", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_governance_configs",
                schema: "aegis");

            migrationBuilder.DropColumn(
                name: "ai_translated",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "detected_language",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "english_text",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "extracted_json",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "language_confidence",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "normalized_text",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "below_threshold",
                schema: "aegis",
                table: "ai_recommendations");

            migrationBuilder.DropColumn(
                name: "counterfactual_note",
                schema: "aegis",
                table: "ai_recommendations");

            migrationBuilder.DropColumn(
                name: "is_shadow",
                schema: "aegis",
                table: "ai_recommendations");

            migrationBuilder.DropColumn(
                name: "prompt_version",
                schema: "aegis",
                table: "ai_recommendations");
        }
    }
}

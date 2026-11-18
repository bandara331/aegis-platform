using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CitizenRequestFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_assistance_requests_crises_crisis_id",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.AlterColumn<Guid>(
                name: "crisis_id",
                schema: "aegis",
                table: "assistance_requests",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contact_email",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "contact_mobile",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "feedback_comment",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "feedback_rating",
                schema: "aegis",
                table: "assistance_requests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "feedback_submitted_at",
                schema: "aegis",
                table: "assistance_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rejection_reason",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "vulnerable_flags",
                schema: "aegis",
                table: "assistance_requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "fk_assistance_requests_crises_crisis_id",
                schema: "aegis",
                table: "assistance_requests",
                column: "crisis_id",
                principalSchema: "aegis",
                principalTable: "crises",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_assistance_requests_crises_crisis_id",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "contact_email",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "contact_mobile",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "feedback_comment",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "feedback_rating",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "feedback_submitted_at",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "rejection_reason",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.DropColumn(
                name: "vulnerable_flags",
                schema: "aegis",
                table: "assistance_requests");

            migrationBuilder.AlterColumn<Guid>(
                name: "crisis_id",
                schema: "aegis",
                table: "assistance_requests",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "fk_assistance_requests_crises_crisis_id",
                schema: "aegis",
                table: "assistance_requests",
                column: "crisis_id",
                principalSchema: "aegis",
                principalTable: "crises",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

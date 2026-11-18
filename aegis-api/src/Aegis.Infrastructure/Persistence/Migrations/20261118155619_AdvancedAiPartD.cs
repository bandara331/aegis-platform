using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedAiPartD : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "dispatch_plans",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    routes_json = table.Column<string>(type: "text", nullable: false),
                    unserved_json = table.Column<string>(type: "text", nullable: false),
                    total_distance_km = table.Column<double>(type: "double precision", nullable: false),
                    total_duration_minutes = table.Column<double>(type: "double precision", nullable: false),
                    baseline_duration_minutes = table.Column<double>(type: "double precision", nullable: false),
                    minutes_saved = table.Column<double>(type: "double precision", nullable: false),
                    routing_source = table.Column<string>(type: "text", nullable: false),
                    is_estimated = table.Column<bool>(type: "boolean", nullable: false),
                    requires_second_approver = table.Column<bool>(type: "boolean", nullable: false),
                    explanation = table.Column<string>(type: "text", nullable: false),
                    created_by_id = table.Column<string>(type: "text", nullable: false),
                    approved_by_id = table.Column<string>(type: "text", nullable: true),
                    second_approver_id = table.Column<string>(type: "text", nullable: true),
                    approved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_dispatch_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    vehicle_type = table.Column<string>(type: "text", nullable: false),
                    capacity = table.Column<int>(type: "integer", nullable: false),
                    current_latitude = table.Column<double>(type: "double precision", nullable: false),
                    current_longitude = table.Column<double>(type: "double precision", nullable: false),
                    assigned_volunteer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_driver_name = table.Column<string>(type: "text", nullable: true),
                    availability = table.Column<string>(type: "text", nullable: false),
                    skills = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vehicles", x => x.id);
                    table.ForeignKey(
                        name: "fk_vehicles_volunteers_assigned_volunteer_id",
                        column: x => x.assigned_volunteer_id,
                        principalSchema: "aegis",
                        principalTable: "volunteers",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_assigned_volunteer_id",
                schema: "aegis",
                table: "vehicles",
                column: "assigned_volunteer_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dispatch_plans",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "vehicles",
                schema: "aegis");
        }
    }
}

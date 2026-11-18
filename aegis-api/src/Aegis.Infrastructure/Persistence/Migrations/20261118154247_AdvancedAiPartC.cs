using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedAiPartC : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "district_risk_snapshots",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    district = table.Column<string>(type: "text", nullable: false),
                    latitude = table.Column<double>(type: "double precision", nullable: false),
                    longitude = table.Column<double>(type: "double precision", nullable: false),
                    risk_level = table.Column<string>(type: "text", nullable: false),
                    risk_score = table.Column<double>(type: "double precision", nullable: false),
                    rainfall24h_mm = table.Column<double>(type: "double precision", nullable: true),
                    rainfall72h_mm = table.Column<double>(type: "double precision", nullable: true),
                    river_discharge_m3s = table.Column<double>(type: "double precision", nullable: true),
                    official_alert_level = table.Column<string>(type: "text", nullable: false),
                    open_requests_count = table.Column<int>(type: "integer", nullable: false),
                    factors_json = table.Column<string>(type: "text", nullable: false),
                    data_updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    computed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_stale = table.Column<bool>(type: "boolean", nullable: false),
                    advisory_notice = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_district_risk_snapshots", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stock_forecast_snapshots",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    resource_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_name = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: false),
                    depot = table.Column<string>(type: "text", nullable: false),
                    quantity_available = table.Column<int>(type: "integer", nullable: false),
                    ewma_hourly_rate = table.Column<double>(type: "double precision", nullable: false),
                    estimated_hours = table.Column<double>(type: "double precision", nullable: true),
                    min_hours = table.Column<double>(type: "double precision", nullable: true),
                    max_hours = table.Column<double>(type: "double precision", nullable: true),
                    rainfall_multiplier = table.Column<double>(type: "double precision", nullable: false),
                    has_enough_data = table.Column<bool>(type: "boolean", nullable: false),
                    data_points_count = table.Column<int>(type: "integer", nullable: false),
                    alert_triggered = table.Column<bool>(type: "boolean", nullable: false),
                    explanation = table.Column<string>(type: "text", nullable: false),
                    computed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_forecast_snapshots", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "district_risk_snapshots",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "stock_forecast_snapshots",
                schema: "aegis");
        }
    }
}

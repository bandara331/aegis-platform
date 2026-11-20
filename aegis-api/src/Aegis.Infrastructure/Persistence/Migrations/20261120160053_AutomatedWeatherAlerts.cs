using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AutomatedWeatherAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "alert_opt_in",
                schema: "aegis",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "district",
                schema: "aegis",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "automated_alerts",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    district = table.Column<string>(type: "text", nullable: false),
                    previous_level = table.Column<string>(type: "text", nullable: false),
                    triggered_level = table.Column<string>(type: "text", nullable: false),
                    alert_kind = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    dedupe_key = table.Column<string>(type: "text", nullable: false),
                    rule_id = table.Column<Guid>(type: "uuid", nullable: true),
                    rule_snapshot_json = table.Column<string>(type: "text", nullable: false),
                    triggering_values_json = table.Column<string>(type: "text", nullable: false),
                    data_source = table.Column<string>(type: "text", nullable: false),
                    data_timestamp_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    model_used = table.Column<string>(type: "text", nullable: false),
                    prompt_version = table.Column<string>(type: "text", nullable: false),
                    message_en = table.Column<string>(type: "text", nullable: false),
                    message_si = table.Column<string>(type: "text", nullable: false),
                    message_ta = table.Column<string>(type: "text", nullable: false),
                    recipient_count = table.Column<int>(type: "integer", nullable: false),
                    approved_by_id = table.Column<string>(type: "text", nullable: true),
                    approved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    sent_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    retracted_by_id = table.Column<string>(type: "text", nullable: true),
                    retracted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    retraction_reason = table.Column<string>(type: "text", nullable: true),
                    is_false_alarm = table.Column<bool>(type: "boolean", nullable: false),
                    false_alarm_marked_by_id = table.Column<string>(type: "text", nullable: true),
                    false_alarm_marked_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    false_alarm_notes = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automated_alerts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "weather_alert_rules",
                schema: "aegis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    mode = table.Column<string>(type: "text", nullable: false),
                    trigger_levels = table.Column<string>(type: "text", nullable: false),
                    rainfall24h_high_mm = table.Column<double>(type: "double precision", nullable: false),
                    rainfall24h_severe_mm = table.Column<double>(type: "double precision", nullable: false),
                    rainfall72h_high_mm = table.Column<double>(type: "double precision", nullable: false),
                    rainfall72h_severe_mm = table.Column<double>(type: "double precision", nullable: false),
                    river_discharge_high_m3s = table.Column<double>(type: "double precision", nullable: false),
                    river_discharge_severe_m3s = table.Column<double>(type: "double precision", nullable: false),
                    cooldown_hours = table.Column<int>(type: "integer", nullable: false),
                    hysteresis_margin = table.Column<double>(type: "double precision", nullable: false),
                    send_risk_reduced_notice = table.Column<bool>(type: "boolean", nullable: false),
                    daily_alert_cap_per_district = table.Column<int>(type: "integer", nullable: false),
                    max_data_age_minutes = table.Column<int>(type: "integer", nullable: false),
                    last_evaluated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_evaluation_status = table.Column<string>(type: "text", nullable: true),
                    updated_by_id = table.Column<string>(type: "text", nullable: true),
                    last_change_reason = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_weather_alert_rules", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_automated_alerts_dedupe_key",
                schema: "aegis",
                table: "automated_alerts",
                column: "dedupe_key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "automated_alerts",
                schema: "aegis");

            migrationBuilder.DropTable(
                name: "weather_alert_rules",
                schema: "aegis");

            migrationBuilder.DropColumn(
                name: "alert_opt_in",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "district",
                schema: "aegis",
                table: "users");
        }
    }
}

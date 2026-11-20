using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aegis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CitizenGpsWeatherTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "last_latitude",
                schema: "aegis",
                table: "users",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "last_longitude",
                schema: "aegis",
                table: "users",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "location_updated_at_utc",
                schema: "aegis",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_latitude",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "last_longitude",
                schema: "aegis",
                table: "users");

            migrationBuilder.DropColumn(
                name: "location_updated_at_utc",
                schema: "aegis",
                table: "users");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LTropik.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHotPathIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_attendance_and_grades_lesson_id",
                table: "attendance_and_grades");

            migrationBuilder.CreateIndex(
                name: "ix_attendance_and_grades_lesson_id_lesson_date",
                table: "attendance_and_grades",
                columns: new[] { "lesson_id", "lesson_date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_attendance_and_grades_lesson_id_lesson_date",
                table: "attendance_and_grades");

            migrationBuilder.CreateIndex(
                name: "ix_attendance_and_grades_lesson_id",
                table: "attendance_and_grades",
                column: "lesson_id");
        }
    }
}

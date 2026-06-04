using System.Security.Claims;
using ClosedXML.Excel;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Teacher,Admin,Manager")]
public class ExportController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet("journal/{courseId:guid}")]
    public async Task<IActionResult> ExportJournal(Guid courseId, CancellationToken ct)
    {
        var course = await db.Courses.FindAsync([courseId], ct);
        if (course == null) return NotFound();

        var records = await db.AttendanceAndGrades
            .Include(a => a.Student)
            .Include(a => a.Grade)
            .Include(a => a.Lesson).ThenInclude(l => l.Module)
            .Where(a => a.Lesson.Module.CourseId == courseId)
            .OrderBy(a => a.Student.LastName)
            .ThenBy(a => a.LessonDate)
            .ToListAsync(ct);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Журнал");

        ws.Cell(1, 1).Value = "Студент";
        ws.Cell(1, 2).Value = "Email";
        ws.Cell(1, 3).Value = "Урок";
        ws.Cell(1, 4).Value = "Дата";
        ws.Cell(1, 5).Value = "Відвідуваність";
        ws.Cell(1, 6).Value = "Оцінка";

        var headerRow = ws.Row(1);
        headerRow.Style.Font.Bold = true;
        headerRow.Style.Fill.BackgroundColor = XLColor.FromHtml("#6535f6");
        headerRow.Style.Font.FontColor = XLColor.White;

        var row = 2;
        foreach (var r in records)
        {
            ws.Cell(row, 1).Value = $"{r.Student.FirstName} {r.Student.LastName}";
            ws.Cell(row, 2).Value = r.Student.Email;
            ws.Cell(row, 3).Value = r.Lesson.Title;
            ws.Cell(row, 4).Value = r.LessonDate.ToString("dd.MM.yyyy");
            ws.Cell(row, 5).Value = r.Attendance.ToString();
            ws.Cell(row, 6).Value = r.Grade?.ValueString ?? "—";
            row++;
        }

        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Seek(0, SeekOrigin.Begin);

        var fileName = $"journal_{course.Title.Replace(" ", "_")}_{DateTime.UtcNow:yyyyMMdd}.xlsx";
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    [HttpGet("student/{studentId:guid}")]
    public async Task<IActionResult> ExportStudentReport(Guid studentId, CancellationToken ct)
    {
        var student = await db.Users.FindAsync([studentId], ct);
        if (student == null) return NotFound();

        var records = await db.AttendanceAndGrades
            .Include(a => a.Grade)
            .Include(a => a.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Where(a => a.StudentId == studentId)
            .OrderBy(a => a.Lesson.Module.Course.Title)
            .ThenBy(a => a.LessonDate)
            .ToListAsync(ct);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Звіт студента");

        ws.Cell(1, 1).Value = "Курс";
        ws.Cell(1, 2).Value = "Урок";
        ws.Cell(1, 3).Value = "Дата";
        ws.Cell(1, 4).Value = "Відвідуваність";
        ws.Cell(1, 5).Value = "Оцінка";

        var headerRow = ws.Row(1);
        headerRow.Style.Font.Bold = true;
        headerRow.Style.Fill.BackgroundColor = XLColor.FromHtml("#6535f6");
        headerRow.Style.Font.FontColor = XLColor.White;

        var row = 2;
        foreach (var r in records)
        {
            ws.Cell(row, 1).Value = r.Lesson.Module.Course.Title;
            ws.Cell(row, 2).Value = r.Lesson.Title;
            ws.Cell(row, 3).Value = r.LessonDate.ToString("dd.MM.yyyy");
            ws.Cell(row, 4).Value = r.Attendance.ToString();
            ws.Cell(row, 5).Value = r.Grade?.ValueString ?? "—";
            row++;
        }

        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Seek(0, SeekOrigin.Begin);

        var name = $"{student.FirstName}_{student.LastName}";
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"student_report_{name}_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }
}

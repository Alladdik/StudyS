using System.Security.Claims;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CertificatesController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("{courseId:guid}")]
    public async Task<IActionResult> Generate(Guid courseId, CancellationToken ct)
    {
        var userId = CurrentUserId;

        var student = await db.Users.FindAsync([userId], ct);
        if (student == null) return NotFound();

        var course = await db.Courses
            .Include(c => c.Modules).ThenInclude(m => m.Lessons)
            .FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course == null) return NotFound();

        var allLessonIds = course.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList();
        var completedCount = await db.CourseProgresses
            .CountAsync(cp => cp.StudentId == userId && allLessonIds.Contains(cp.LessonId), ct);

        if (allLessonIds.Count == 0 || completedCount < allLessonIds.Count)
            return BadRequest(new { error = "Курс не завершено. Пройдіть усі уроки перед отриманням сертифікату." });

        var pdfBytes = GeneratePdf(
            $"{student.FirstName} {student.LastName}",
            course.Title,
            DateOnly.FromDateTime(DateTime.UtcNow));

        return File(pdfBytes, "application/pdf", $"certificate_{courseId}.pdf");
    }

    private static byte[] GeneratePdf(string studentName, string courseTitle, DateOnly date)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(60);
                page.DefaultTextStyle(x => x.FontFamily("Arial"));

                page.Content().Column(col =>
                {
                    col.Item().AlignCenter().Text("СЕРТИФІКАТ").FontSize(40).Bold().FontColor("#6535f6");
                    col.Item().Height(20);
                    col.Item().AlignCenter().Text("Цим підтверджується, що").FontSize(16).FontColor("#4b5563");
                    col.Item().Height(10);
                    col.Item().AlignCenter().Text(studentName).FontSize(28).Bold().FontColor("#111827");
                    col.Item().Height(10);
                    col.Item().AlignCenter().Text("успішно завершив(ла) курс").FontSize(16).FontColor("#4b5563");
                    col.Item().Height(10);
                    col.Item().AlignCenter().Text($"«{courseTitle}»").FontSize(22).Bold().FontColor("#111827");
                    col.Item().Height(30);
                    col.Item().AlignCenter().Text($"Дата: {date:dd.MM.yyyy}").FontSize(14).FontColor("#6b7280");
                    col.Item().Height(40);
                    col.Item().AlignCenter().Text("LTropik — Онлайн-школа").FontSize(12).FontColor("#9ca3af");
                });
            });
        }).GeneratePdf();
    }
}

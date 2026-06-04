using System.Security.Claims;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Student")]
public class ProgressController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("{courseId:guid}")]
    public async Task<IActionResult> GetCourseProgress(Guid courseId, CancellationToken ct)
    {
        var studentId = CurrentUserId;

        var course = await db.Courses
            .Include(c => c.Modules).ThenInclude(m => m.Lessons)
            .FirstOrDefaultAsync(c => c.Id == courseId, ct);

        if (course == null) return NotFound();

        var allLessonIds = course.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList();
        var completedIds = await db.CourseProgresses
            .Where(cp => cp.StudentId == studentId && allLessonIds.Contains(cp.LessonId))
            .Select(cp => cp.LessonId)
            .ToListAsync(ct);

        var total = allLessonIds.Count;
        var completed = completedIds.Count;

        return Ok(new CourseProgressDto(
            course.Id, course.Title,
            total, completed,
            total == 0 ? 0 : Math.Round((double)completed / total * 100, 1),
            completedIds.ToArray()));
    }

    [HttpPost("complete")]
    public async Task<IActionResult> MarkComplete(MarkLessonCompleteRequest req, CancellationToken ct)
    {
        var studentId = CurrentUserId;

        var already = await db.CourseProgresses
            .AnyAsync(cp => cp.StudentId == studentId && cp.LessonId == req.LessonId, ct);

        if (already) return Ok(new { alreadyCompleted = true });

        db.CourseProgresses.Add(new CourseProgress
        {
            StudentId = studentId,
            LessonId = req.LessonId
        });
        await db.SaveChangesAsync(ct);

        // Auto-certificate: check if course is 100% complete
        var courseId2 = await db.Lessons
            .Where(l => l.Id == req.LessonId)
            .Select(l => l.Module.CourseId)
            .FirstOrDefaultAsync(ct);

        if (courseId2 != default)
        {
            var allCourseIds = await db.Lessons
                .Where(l => l.Module.CourseId == courseId2)
                .Select(l => l.Id)
                .ToListAsync(ct);

            var completedCount = await db.CourseProgresses
                .CountAsync(cp => cp.StudentId == studentId && allCourseIds.Contains(cp.LessonId), ct);

            if (completedCount >= allCourseIds.Count && allCourseIds.Count > 0)
            {
                var svcs2 = HttpContext.RequestServices;
                var sid2  = studentId;
                var cid2  = courseId2;
                _ = Task.Run(async () =>
                {
                    using var scope = svcs2.CreateScope();
                    await SendAutoCertAsync(scope, sid2, cid2);
                });
            }
        }

        // Complete daily quest "view_lesson"
        // (fire-and-forget — don't block the response)
        var services = HttpContext.RequestServices;
        var sid = studentId;
        _ = Task.Run(async () =>
        {
            using var scope = services.CreateScope();
            var questDb = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var sq = await questDb.StudentDailyQuests
                .Include(x => x.Quest)
                .FirstOrDefaultAsync(x =>
                    x.StudentId == sid && x.Date == today &&
                    x.Quest.Type == "view_lesson" && x.CompletedAt == null);
            if (sq != null)
            {
                sq.CompletedAt = DateTimeOffset.UtcNow;
                var streak = await questDb.StudentStreaks.FindAsync([sid]);
                if (streak != null) { streak.TotalCoins += sq.Quest.CoinsReward; }
                await questDb.SaveChangesAsync();
            }
        });

        return Ok(new { completed = true });
    }

    // ── Auto-cert helper ──────────────────────────────────────────────────────
    private static async Task SendAutoCertAsync(IServiceScope scope, Guid studentId, Guid courseId)
    {
        var db       = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var notif    = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var telegram = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
        var email    = scope.ServiceProvider.GetRequiredService<IEmailService>();

        var student = await db.Users.FindAsync([studentId]);
        var course  = await db.Courses.FindAsync([courseId]);
        if (student == null || course == null) return;

        // Generate PDF
        QuestPDF.Settings.License = LicenseType.Community;
        var pdfBytes = Document.Create(c =>
        {
            c.Page(p =>
            {
                p.Size(PageSizes.A4.Landscape());
                p.Margin(60);
                p.DefaultTextStyle(x => x.FontFamily("Arial"));
                p.Content().Column(col =>
                {
                    col.Item().AlignCenter().Text("🎓 СЕРТИФІКАТ").FontSize(38).Bold().FontColor("#6535f6");
                    col.Item().Height(18);
                    col.Item().AlignCenter().Text("Цим підтверджується, що").FontSize(15).FontColor("#4b5563");
                    col.Item().Height(8);
                    col.Item().AlignCenter().Text($"{student.FirstName} {student.LastName}").FontSize(28).Bold().FontColor("#111827");
                    col.Item().Height(8);
                    col.Item().AlignCenter().Text("успішно завершив(ла) курс").FontSize(15).FontColor("#4b5563");
                    col.Item().Height(8);
                    col.Item().AlignCenter().Text($"«{course.Title}»").FontSize(22).Bold().FontColor("#111827");
                    col.Item().Height(28);
                    col.Item().AlignCenter().Text($"Дата: {DateTime.UtcNow:dd.MM.yyyy}").FontSize(13).FontColor("#6b7280");
                    col.Item().Height(36);
                    col.Item().AlignCenter().Text("LTropik — Онлайн-школа нового покоління").FontSize(11).FontColor("#9ca3af");
                });
            });
        }).GeneratePdf();

        // In-app notification
        await notif.SendAsync(studentId, "CourseCompleted",
            "🎓 Курс завершено!", $"Вітаємо! Ви пройшли «{course.Title}». Сертифікат надіслано на email.",
            $"/certificates/{courseId}");

        // Email with PDF attachment
        await email.SendAsync(student.Email,
            $"🎓 Сертифікат про завершення курсу «{course.Title}»",
            $"<h2>Вітаємо, {student.FirstName}!</h2><p>Ви успішно завершили курс <b>{course.Title}</b>. Сертифікат у вкладенні.</p>",
            attachments: [new EmailAttachment($"certificate_{courseId}.pdf", pdfBytes, "application/pdf")]);

        // Telegram to student
        if (student.TelegramId != null)
            await telegram.SendAsync(student.TelegramId,
                $"🎓 <b>Вітаємо!</b> Ви завершили курс «{course.Title}»!\nСертифікат надіслано на {student.Email}");

        // Telegram to parents
        var parents = await db.ParentStudents
            .Where(ps => ps.StudentId == studentId)
            .Include(ps => ps.Parent)
            .Select(ps => ps.Parent)
            .Where(p => p.TelegramId != null)
            .ToListAsync();

        foreach (var parent in parents)
            await telegram.SendAsync(parent.TelegramId!,
                $"🎓 <b>{student.FirstName} {student.LastName}</b> завершив(ла) курс «{course.Title}»! Сертифікат надіслано на email.");
    }

    // Get next uncompleted lesson in a course
    [HttpGet("{courseId:guid}/next-lesson")]
    public async Task<IActionResult> GetNextLesson(Guid courseId, CancellationToken ct)
    {
        var studentId = CurrentUserId;

        var course = await db.Courses
            .Include(c => c.Modules).ThenInclude(m => m.Lessons)
            .FirstOrDefaultAsync(c => c.Id == courseId, ct);

        if (course == null) return NotFound();

        var completedIds = await db.CourseProgresses
            .Where(cp => cp.StudentId == studentId)
            .Select(cp => cp.LessonId)
            .ToListAsync(ct);

        var next = course.Modules
            .OrderBy(m => m.SortOrder)
            .SelectMany(m => m.Lessons.OrderBy(l => l.SortOrder).Select(l => new { l.Id, l.Title, ModuleTitle = m.Title }))
            .FirstOrDefault(l => !completedIds.Contains(l.Id));

        return Ok(next);
    }

    // Get all courses progress for current student (for dashboard)
    [HttpGet("all")]
    public async Task<IActionResult> GetAllProgress(CancellationToken ct)
    {
        var studentId = CurrentUserId;

        var courses = await db.CourseStudents
            .Where(cs => cs.StudentId == studentId)
            .Include(cs => cs.Course)
            .ThenInclude(c => c.Modules)
            .ThenInclude(m => m.Lessons)
            .ToListAsync(ct);

        var completedIds = await db.CourseProgresses
            .Where(cp => cp.StudentId == studentId)
            .Select(cp => cp.LessonId)
            .ToListAsync(ct);

        var result = courses.Select(cs =>
        {
            var allLessons = cs.Course.Modules.SelectMany(m => m.Lessons).ToList();
            var done = allLessons.Count(l => completedIds.Contains(l.Id));
            return new
            {
                CourseId = cs.Course.Id,
                CourseTitle = cs.Course.Title,
                Total = allLessons.Count,
                Completed = done,
                Percent = allLessons.Count == 0 ? 0 : Math.Round((double)done / allLessons.Count * 100, 1)
            };
        });

        return Ok(result);
    }
}

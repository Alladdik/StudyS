using LTropik.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

/// <summary>
/// Runs every 5 minutes. Sends a Telegram reminder 30 minutes before a scheduled lesson.
/// </summary>
public class LessonReminderWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<LessonReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;

            try { await SendRemindersAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "LessonReminderWorker error"); }
        }
    }

    private async Task SendRemindersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db       = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var telegram = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
        var notif    = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now       = DateTimeOffset.UtcNow;
        var windowEnd = now.AddMinutes(35);
        var windowStart = now.AddMinutes(25);

        // Schedules starting in ~30 min (25-35 min window to catch each check cycle)
        var upcoming = await db.Schedules
            .Include(s => s.Lesson)
                .ThenInclude(l => l.Module)
                    .ThenInclude(m => m.Course)
                        .ThenInclude(c => c.Students)
            .Include(s => s.Teacher)
            .Where(s => s.StartsAt >= windowStart && s.StartsAt <= windowEnd)
            .ToListAsync(ct);

        foreach (var schedule in upcoming)
        {
            var course      = schedule.Lesson.Module.Course;
            var lessonTitle = schedule.Lesson.Title;
            var courseTitle = course.Title;
            var startsAt    = schedule.StartsAt;
            var teacherName = $"{schedule.Teacher.FirstName} {schedule.Teacher.LastName}";

            foreach (var enrollment in course.Students)
            {
                var student = await db.Users.FindAsync([enrollment.StudentId], ct);
                if (student == null) continue;

                var msg = $"📅 <b>Через 30 хвилин урок!</b>\n\n" +
                          $"📚 {courseTitle}\n" +
                          $"📖 {lessonTitle}\n" +
                          $"👤 Викладач: {teacherName}\n" +
                          $"🕐 Початок: {startsAt.ToLocalTime():HH:mm}";

                // In-app notification
                await notif.SendAsync(student.Id, "LessonReminder",
                    "Урок починається!", $"Через 30 хв — {courseTitle}: {lessonTitle}",
                    "/student/courses", ct);

                // Telegram
                if (student.TelegramId != null)
                    await telegram.SendAsync(student.TelegramId, msg, ct);

                // Notify parents too
                var parents = await db.ParentStudents
                    .Where(ps => ps.StudentId == student.Id)
                    .Include(ps => ps.Parent)
                    .Select(ps => ps.Parent)
                    .Where(p => p.TelegramId != null)
                    .ToListAsync(ct);

                foreach (var parent in parents)
                    await telegram.SendAsync(parent.TelegramId!,
                        $"📅 <b>У {student.FirstName} {student.LastName} урок через 30 хв</b>\n" +
                        $"📚 {courseTitle} — {lessonTitle}\n" +
                        $"🕐 {startsAt.ToLocalTime():HH:mm}", ct);
            }
        }

        if (upcoming.Count > 0)
            logger.LogInformation("LessonReminderWorker: sent reminders for {Count} schedules", upcoming.Count);
    }
}

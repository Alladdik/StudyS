using LTropik.Application.Interfaces;
using LTropik.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

/// <summary>
/// Runs every hour. Sends Telegram + in-app reminders when homework deadline is within 24h.
/// </summary>
public class HomeworkReminderWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<HomeworkReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;

            try { await SendRemindersAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "HomeworkReminderWorker error"); }
        }
    }

    private async Task SendRemindersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db       = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var telegram = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
        var notif    = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now       = DateTimeOffset.UtcNow;
        var threshold = now.AddHours(24);

        // Find homework with upcoming deadline (not yet reminded)
        var homeworks = await db.Homeworks
            .Include(h => h.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .ThenInclude(c => c.Students)
            .Where(h => h.DueDate != null
                     && h.DueDate <= threshold
                     && h.DueDate > now
                     && !h.ReminderSent)
            .ToListAsync(ct);

        foreach (var hw in homeworks)
        {
            var courseName = hw.Lesson.Module.Course.Title;
            var hoursLeft  = Math.Round((hw.DueDate!.Value - now).TotalHours, 0);

            foreach (var enrollment in hw.Lesson.Module.Course.Students)
            {
                var studentId = enrollment.StudentId;

                // Skip if already submitted
                var submitted = await db.HomeworkSubmissions
                    .AnyAsync(s => s.HomeworkId == hw.Id && s.StudentId == studentId
                               && s.Status != HomeworkStatus.NotStarted, ct);
                if (submitted) continue;

                var message = $"⏰ До дедлайну ДЗ залишилось {hoursLeft} год!\n" +
                              $"Курс: {courseName}\n" +
                              $"Завдання: {hw.Instruction.Substring(0, Math.Min(80, hw.Instruction.Length))}…";

                // In-app
                await notif.SendAsync(studentId, "HomeworkDeadline",
                    "Дедлайн наближається!", $"До здачі ДЗ по «{courseName}» — {hoursLeft} год",
                    "/student/courses", ct);

                // Telegram to student
                var student = await db.Users.FindAsync([studentId], ct);
                if (student?.TelegramId != null)
                    await telegram.SendAsync(student.TelegramId, message, ct);

                // Telegram to parents
                var parents = await db.ParentStudents
                    .Where(ps => ps.StudentId == studentId)
                    .Include(ps => ps.Parent)
                    .Select(ps => ps.Parent)
                    .Where(p => p.TelegramId != null)
                    .ToListAsync(ct);

                foreach (var parent in parents)
                    await telegram.SendAsync(parent.TelegramId!,
                        $"⏰ <b>{student?.FirstName} {student?.LastName}</b> — дедлайн ДЗ через {hoursLeft} год!\n" +
                        $"Курс: {courseName}", ct);
            }

            hw.ReminderSent = true;
        }

        if (homeworks.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("HomeworkReminderWorker: sent reminders for {Count} homeworks", homeworks.Count);
        }
    }
}

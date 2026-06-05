using LTropik.Application.Interfaces;
using LTropik.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

/// <summary>
/// Runs once a day at 20:00 UTC.
/// Sends a Telegram reminder to students who have a streak but haven't been active today.
/// </summary>
public class StreakReminderWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<StreakReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = GetDelayUntilNext20();
            logger.LogInformation("StreakReminderWorker sleeping {Hours:F1}h until 20:00 UTC", delay.TotalHours);

            await Task.Delay(delay, stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;

            try { await SendStreakRemindersAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "StreakReminderWorker error"); }
        }
    }

    private static TimeSpan GetDelayUntilNext20()
    {
        var now    = DateTime.UtcNow;
        var target = now.Date.AddHours(20);
        if (target <= now)
            target = target.AddDays(1);
        return target - now;
    }

    private async Task SendStreakRemindersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db       = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var telegram = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
        var notif    = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var today     = DateOnly.FromDateTime(DateTime.UtcNow);
        var yesterday = today.AddDays(-1);

        // Students with a streak of 2+ who haven't been active today
        var streaks = await db.StudentStreaks
            .Include(s => s.Student)
            .Where(s =>
                s.CurrentStreak >= 2 &&
                s.LastActivityDate == yesterday &&   // active yesterday but not today yet
                s.Student.Role == UserRole.Student &&
                s.Student.IsActive &&
                s.Student.TelegramId != null)
            .ToListAsync(ct);

        int sent = 0;
        foreach (var streak in streaks)
        {
            var student    = streak.Student;
            var streakDays = streak.CurrentStreak;
            var fireEmoji  = streakDays >= 30 ? "🔥🔥🔥" : streakDays >= 7 ? "🔥🔥" : "🔥";

            var msg = $"{fireEmoji} <b>Не втрать серію!</b>\n\n" +
                      $"Ти навчаєшся {streakDays} {"день".Decline(streakDays)} поспіль.\n" +
                      $"Зайди на LTropik сьогодні, щоб не втратити прогрес! 💪";

            await telegram.SendAsync(student.TelegramId!, msg, ct);

            await notif.SendAsync(student.Id, "StreakReminder",
                $"{fireEmoji} Серія {streakDays} дн. під загрозою!",
                "Зайди сьогодні, щоб зберегти прогрес",
                "/", ct);

            sent++;
        }

        logger.LogInformation("StreakReminderWorker: sent {Count} streak reminders", sent);
    }
}

internal static class StringDeclensionExtensions
{
    // Ukrainian: 1 день / 2-4 дні / 5+ днів
    public static string Decline(this string _, int count)
    {
        var mod10  = count % 10;
        var mod100 = count % 100;
        if (mod100 >= 11 && mod100 <= 14) return "днів";
        return mod10 switch { 1 => "день", >= 2 and <= 4 => "дні", _ => "днів" };
    }
}

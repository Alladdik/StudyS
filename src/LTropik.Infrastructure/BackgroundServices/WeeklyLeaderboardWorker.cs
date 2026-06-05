using LTropik.Application.Interfaces;
using LTropik.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

/// <summary>
/// Runs every Sunday at 18:00 UTC.
/// Sends a weekly XP leaderboard to all students connected to Telegram.
/// </summary>
public class WeeklyLeaderboardWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<WeeklyLeaderboardWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = GetDelayUntilNextSunday18();
            logger.LogInformation("WeeklyLeaderboardWorker sleeping {Hours:F1}h until Sunday 18:00 UTC", delay.TotalHours);

            await Task.Delay(delay, stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;

            try { await SendLeaderboardAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "WeeklyLeaderboardWorker error"); }
        }
    }

    private static TimeSpan GetDelayUntilNextSunday18()
    {
        var now    = DateTime.UtcNow;
        var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)now.DayOfWeek + 7) % 7;
        if (daysUntilSunday == 0 && now.Hour >= 18)
            daysUntilSunday = 7; // already past Sunday 18:00 this week

        var target = now.Date.AddDays(daysUntilSunday).AddHours(18);
        return target - now;
    }

    private async Task SendLeaderboardAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db       = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var telegram = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();

        // Top 10 students by total XP
        var top = await db.StudentStreaks
            .Include(s => s.Student)
            .Where(s => s.Student.Role == UserRole.Student && s.Student.IsActive)
            .OrderByDescending(s => s.TotalXp)
            .Take(10)
            .Select(s => new { s.Student.FirstName, s.Student.LastName, s.TotalXp, s.CurrentStreak, s.Student.TelegramId, s.Student.Id })
            .ToListAsync(ct);

        if (top.Count == 0) return;

        // Build leaderboard message
        var medals = new[] { "🥇", "🥈", "🥉" };
        var lines  = top.Select((s, i) =>
        {
            var medal = i < 3 ? medals[i] : $"{i + 1}.";
            var streak = s.CurrentStreak > 0 ? $" 🔥{s.CurrentStreak}" : "";
            return $"{medal} {s.FirstName} {s.LastName} — {s.TotalXp} XP{streak}";
        }).ToList();

        var leaderboardText = string.Join("\n", lines);
        var weekNumber      = System.Globalization.ISOWeek.GetWeekOfYear(DateTime.UtcNow);

        // Send to everyone in the top (personalized message with their position)
        foreach (var student in top.Where(s => s.TelegramId != null))
        {
            var position = top.IndexOf(student) + 1;
            var posEmoji = position <= 3 ? medals[position - 1] : $"#{position}";

            var msg = $"🏆 <b>Рейтинг тижня #{weekNumber}</b>\n\n" +
                      $"{leaderboardText}\n\n" +
                      $"Твоя позиція: <b>{posEmoji}</b> з {student.TotalXp} XP\n" +
                      (student.CurrentStreak > 0
                          ? $"🔥 Серія: {student.CurrentStreak} дн. — не зупиняйся!"
                          : "💪 Починай навчатись, щоб потрапити в топ!");

            await telegram.SendAsync(student.TelegramId!, msg, ct);
        }

        // Also notify students NOT in the top but who have Telegram — motivate them
        var topIds = top.Select(s => s.Id).ToHashSet();
        var others = await db.StudentStreaks
            .Include(s => s.Student)
            .Where(s =>
                s.Student.Role == UserRole.Student &&
                s.Student.IsActive &&
                s.Student.TelegramId != null &&
                !topIds.Contains(s.StudentId) &&
                s.TotalXp > 0)
            .Select(s => new { s.Student.TelegramId, s.TotalXp, s.CurrentStreak })
            .ToListAsync(ct);

        foreach (var student in others)
        {
            var msg = $"🏆 <b>Рейтинг тижня #{weekNumber}</b>\n\n" +
                      $"{leaderboardText}\n\n" +
                      $"У тебе {student.TotalXp} XP. Активніше навчайся, щоб потрапити в топ! 🚀";

            await telegram.SendAsync(student.TelegramId!, msg, ct);
        }

        logger.LogInformation("WeeklyLeaderboardWorker: sent leaderboard to {Count} students",
            top.Count(s => s.TelegramId != null) + others.Count);
    }
}

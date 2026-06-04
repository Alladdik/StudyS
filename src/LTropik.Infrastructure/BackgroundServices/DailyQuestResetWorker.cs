using LTropik.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

/// <summary>
/// Runs once a day at midnight UTC, seeds today's quest rows for all active students.
/// </summary>
public class DailyQuestResetWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<DailyQuestResetWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now  = DateTime.UtcNow;
            var next = now.Date.AddDays(1); // midnight tomorrow
            var delay = next - now;
            logger.LogInformation("DailyQuestResetWorker sleeping {Hours:F1}h until midnight reset", delay.TotalHours);

            await Task.Delay(delay, stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;

            try { await SeedTodayAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "DailyQuestReset failed"); }
        }
    }

    private async Task SeedTodayAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db    = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var quests = db.DailyQuests.Where(q => q.IsActive).ToList();
        if (quests.Count == 0) return;

        var students = db.Users
            .Where(u => u.Role == Domain.Enums.UserRole.Student && u.IsActive)
            .Select(u => u.Id)
            .ToList();

        foreach (var studentId in students)
        {
            foreach (var quest in quests)
            {
                if (!db.StudentDailyQuests.Any(sq =>
                    sq.StudentId == studentId && sq.QuestId == quest.Id && sq.Date == today))
                {
                    db.StudentDailyQuests.Add(new Domain.Entities.StudentDailyQuest
                    {
                        StudentId = studentId,
                        QuestId   = quest.Id,
                        Date      = today
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("DailyQuestReset: seeded quests for {Count} students", students.Count);
    }
}

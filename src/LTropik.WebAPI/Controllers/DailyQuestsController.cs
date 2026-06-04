using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DailyQuestsController(
    IApplicationDbContext db,
    IGamificationService gamification) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Student: get today's quests with completion status
    [HttpGet("today")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetToday(CancellationToken ct)
    {
        var today    = DateOnly.FromDateTime(DateTime.UtcNow);
        var quests   = await db.DailyQuests.Where(q => q.IsActive).ToListAsync(ct);
        var studentId = CurrentUserId;

        // Ensure today's quest rows exist
        foreach (var q in quests)
        {
            if (!await db.StudentDailyQuests.AnyAsync(
                sq => sq.StudentId == studentId && sq.QuestId == q.Id && sq.Date == today, ct))
            {
                db.StudentDailyQuests.Add(new StudentDailyQuest
                {
                    StudentId = studentId,
                    QuestId   = q.Id,
                    Date      = today
                });
            }
        }
        await db.SaveChangesAsync(ct);

        var result = await db.StudentDailyQuests
            .Include(sq => sq.Quest)
            .Where(sq => sq.StudentId == studentId && sq.Date == today)
            .Select(sq => new
            {
                sq.Id,
                sq.CompletedAt,
                IsCompleted = sq.CompletedAt != null,
                Quest = new
                {
                    sq.Quest.Id, sq.Quest.Type, sq.Quest.Title,
                    sq.Quest.Description, sq.Quest.Icon, sq.Quest.CoinsReward
                }
            })
            .ToListAsync(ct);

        return Ok(result);
    }

    // Called internally to complete a quest by type
    [HttpPost("complete/{type}")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Complete(string type, CancellationToken ct)
    {
        var today     = DateOnly.FromDateTime(DateTime.UtcNow);
        var studentId = CurrentUserId;

        var sq = await db.StudentDailyQuests
            .Include(x => x.Quest)
            .FirstOrDefaultAsync(x =>
                x.StudentId == studentId &&
                x.Date == today &&
                x.Quest.Type == type &&
                x.CompletedAt == null, ct);

        if (sq == null) return Ok(new { alreadyDone = true });

        sq.CompletedAt = DateTimeOffset.UtcNow;

        // Award coins — find or create streak in the same SaveChanges
        var streak = await db.StudentStreaks.FirstOrDefaultAsync(s => s.StudentId == studentId, ct);
        if (streak == null)
        {
            streak = new StudentStreak { StudentId = studentId };
            db.StudentStreaks.Add(streak);
        }
        streak.TotalCoins += sq.Quest.CoinsReward;
        streak.TotalXp    += sq.Quest.CoinsReward / 2;

        await db.SaveChangesAsync(ct);

        // Check if all 3 quests done → bonus
        var allDone = await db.StudentDailyQuests
            .Where(x => x.StudentId == studentId && x.Date == today)
            .AllAsync(x => x.CompletedAt != null, ct);

        if (allDone)
        {
            streak.TotalCoins += 25; // bonus for completing all
            await db.SaveChangesAsync(ct);
        }

        return Ok(new { coins = sq.Quest.CoinsReward, allDone, bonusCoins = allDone ? 25 : 0 });
    }

    // Admin: seed default quests
    [HttpPost("seed")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Seed(CancellationToken ct)
    {
        if (await db.DailyQuests.AnyAsync(ct))
            return Conflict(new { error = "Завдання вже існують" });

        db.DailyQuests.AddRange(
            new DailyQuest { Type = "login",           Title = "Увійти на сайт",       Description = "Відкрий платформу та перевір розклад", Icon = "🌅", CoinsReward = 5  },
            new DailyQuest { Type = "view_lesson",     Title = "Переглянути урок",     Description = "Відкрий будь-який урок і вивчи матеріал", Icon = "📚", CoinsReward = 10 },
            new DailyQuest { Type = "submit_homework", Title = "Здати домашнє завдання",Description = "Завантаж виконане ДЗ",                   Icon = "✅", CoinsReward = 20 }
        );
        await db.SaveChangesAsync(ct);
        return Ok(new { seeded = 3 });
    }
}

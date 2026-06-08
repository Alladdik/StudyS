using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.WebAPI.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GamificationController(
    IGamificationService gamification,
    IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("progress")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetProgress(CancellationToken ct)
    {
        var progress = await gamification.GetProgressAsync(CurrentUserId, ct);
        return Ok(progress);
    }

    [HttpPost("spend-coins")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> SpendCoins([FromBody] int amount, CancellationToken ct)
    {
        try
        {
            await gamification.SpendCoinsAsync(CurrentUserId, amount, ct);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // Admin: seed default badges
    [HttpPost("badges/seed")]
    [Authorize(Roles = "Admin")]
    [Audit("BadgesSeeded")]
    public async Task<IActionResult> SeedBadges(CancellationToken ct)
    {
        if (await db.Badges.AnyAsync(ct))
            return Conflict(new { error = "Бейджі вже існують" });

        var badges = new List<Badge>
        {
            new() { Name = "Перший крок",    Description = "Здай перше ДЗ",           Icon = "🎯", Condition = "homeworks_passed", ConditionValue = 1,  CoinsReward = 10 },
            new() { Name = "Тижнева серія",  Description = "7 днів поспіль активності",Icon = "🔥", Condition = "streak",          ConditionValue = 7,  CoinsReward = 50 },
            new() { Name = "Місячна серія",  Description = "30 днів поспіль",          Icon = "🌟", Condition = "streak",          ConditionValue = 30, CoinsReward = 200 },
            new() { Name = "Відмінник",      Description = "10 здanih ДЗ",             Icon = "📚", Condition = "homeworks_passed", ConditionValue = 10, CoinsReward = 30 },
            new() { Name = "Тестоман",       Description = "Пройди 5 тестів",          Icon = "✅", Condition = "tests_passed",    ConditionValue = 5,  CoinsReward = 25 },
            new() { Name = "Легенда",        Description = "100 здaniх ДЗ",            Icon = "🏆", Condition = "homeworks_passed", ConditionValue = 100,CoinsReward = 500 },
            new() { Name = "Багатій",        Description = "Накопич 500 монет",        Icon = "💰", Condition = "coins",           ConditionValue = 500,CoinsReward = 0 },
            new() { Name = "Феномен",        Description = "Серія 100 днів",           Icon = "⚡", Condition = "max_streak",      ConditionValue = 100,CoinsReward = 1000 },
        };

        db.Badges.AddRange(badges);
        await db.SaveChangesAsync(ct);
        return Ok(new { seeded = badges.Count });
    }

    // Award coins to current student (called from games: slots, civ)
    [HttpPost("award-coins")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> AwardCoins([FromBody] int amount, CancellationToken ct)
    {
        if (amount <= 0 || amount > 1000)
            return BadRequest(new { error = "Некоректна сума монет" });

        var streak = await db.StudentStreaks
            .FirstOrDefaultAsync(s => s.StudentId == CurrentUserId, ct);

        if (streak == null)
        {
            streak = new StudentStreak { StudentId = CurrentUserId };
            db.StudentStreaks.Add(streak);
        }

        streak.TotalCoins += amount;
        streak.TotalXp    += amount / 2;   // XP = half the coin reward
        await db.SaveChangesAsync(ct);
        return Ok(new { totalCoins = streak.TotalCoins });
    }

    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard(CancellationToken ct)
    {
        var top = await db.StudentStreaks
            .Include(s => s.Student)
            .OrderByDescending(s => s.TotalCoins)
            .Take(20)
            .Select(s => new
            {
                studentId = s.StudentId,
                name = s.Student.FirstName + " " + s.Student.LastName,
                coins = s.TotalCoins,
                streak = s.CurrentStreak,
                maxStreak = s.MaxStreak
            })
            .ToListAsync(ct);

        return Ok(top);
    }

    // ── Admin: Badges CRUD ────────────────────────────────────────────────────

    [HttpGet("admin/badges")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetBadges(CancellationToken ct)
    {
        var badges = await db.Badges
            .Select(b => new
            {
                b.Id, b.Name, b.Description, b.Icon,
                b.Condition, b.ConditionValue, b.CoinsReward,
                holders = db.StudentBadges.Count(sb => sb.BadgeId == b.Id)
            })
            .ToListAsync(ct);
        return Ok(badges);
    }

    [HttpPost("admin/badges")]
    [Authorize(Roles = "Admin")]
    [Audit("BadgeCreated")]
    public async Task<IActionResult> CreateBadge([FromBody] BadgeRequest req, CancellationToken ct)
    {
        var badge = new Badge
        {
            Name = req.Name, Description = req.Description,
            Icon = req.Icon, Condition = req.Condition,
            ConditionValue = req.ConditionValue, CoinsReward = req.CoinsReward
        };
        db.Badges.Add(badge);
        await db.SaveChangesAsync(ct);
        return Ok(badge);
    }

    [HttpPut("admin/badges/{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("BadgeUpdated")]
    public async Task<IActionResult> UpdateBadge(Guid id, [FromBody] BadgeRequest req, CancellationToken ct)
    {
        var badge = await db.Badges.FindAsync([id], ct);
        if (badge == null) return NotFound();
        badge.Name = req.Name; badge.Description = req.Description;
        badge.Icon = req.Icon; badge.Condition = req.Condition;
        badge.ConditionValue = req.ConditionValue; badge.CoinsReward = req.CoinsReward;
        await db.SaveChangesAsync(ct);
        return Ok(badge);
    }

    [HttpDelete("admin/badges/{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("BadgeDeleted")]
    public async Task<IActionResult> DeleteBadge(Guid id, CancellationToken ct)
    {
        var badge = await db.Badges.FindAsync([id], ct);
        if (badge == null) return NotFound();
        db.Badges.Remove(badge);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── Admin: Daily Quests CRUD ──────────────────────────────────────────────

    [HttpGet("admin/quests")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetQuests(CancellationToken ct) =>
        Ok(await db.DailyQuests.ToListAsync(ct));

    [HttpPost("admin/quests")]
    [Authorize(Roles = "Admin")]
    [Audit("QuestCreated")]
    public async Task<IActionResult> CreateQuest([FromBody] QuestRequest req, CancellationToken ct)
    {
        var quest = new DailyQuest
        {
            Type = req.Type, Title = req.Title, Description = req.Description,
            Icon = req.Icon, CoinsReward = req.CoinsReward, IsActive = req.IsActive
        };
        db.DailyQuests.Add(quest);
        await db.SaveChangesAsync(ct);
        return Ok(quest);
    }

    [HttpPut("admin/quests/{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("QuestUpdated")]
    public async Task<IActionResult> UpdateQuest(Guid id, [FromBody] QuestRequest req, CancellationToken ct)
    {
        var quest = await db.DailyQuests.FindAsync([id], ct);
        if (quest == null) return NotFound();
        quest.Type = req.Type; quest.Title = req.Title; quest.Description = req.Description;
        quest.Icon = req.Icon; quest.CoinsReward = req.CoinsReward; quest.IsActive = req.IsActive;
        await db.SaveChangesAsync(ct);
        return Ok(quest);
    }

    [HttpDelete("admin/quests/{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("QuestDeleted")]
    public async Task<IActionResult> DeleteQuest(Guid id, CancellationToken ct)
    {
        var quest = await db.DailyQuests.FindAsync([id], ct);
        if (quest == null) return NotFound();
        db.DailyQuests.Remove(quest);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── Admin: Manual coin award ──────────────────────────────────────────────

    [HttpPost("admin/award/{userId:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("AdminCoinAward")]
    public async Task<IActionResult> AdminAward(Guid userId, [FromBody] AdminAwardRequest req, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        var streak = await db.StudentStreaks.FirstOrDefaultAsync(s => s.StudentId == userId, ct);
        if (streak == null) { streak = new StudentStreak { StudentId = userId }; db.StudentStreaks.Add(streak); }

        if (req.Amount > 0) { streak.TotalCoins += req.Amount; streak.TotalXp += req.Amount / 2; }
        else { streak.TotalCoins = Math.Max(0, streak.TotalCoins + req.Amount); } // deduct

        await db.SaveChangesAsync(ct);
        return Ok(new { totalCoins = streak.TotalCoins });
    }
}

public record BadgeRequest(string Name, string Description, string Icon, string Condition, int ConditionValue, int CoinsReward);
public record QuestRequest(string Type, string Title, string Description, string Icon, int CoinsReward, bool IsActive);
public record AdminAwardRequest(int Amount, string Reason);

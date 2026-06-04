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
}

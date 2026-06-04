using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LTropik.Application.Services;

public class GamificationService(IApplicationDbContext db) : IGamificationService
{
    // Activity types: "homework_submitted", "homework_passed", "test_passed", "lesson_viewed"
    public async Task RecordActivityAsync(Guid studentId, string activityType, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var streak = await db.StudentStreaks
            .FirstOrDefaultAsync(s => s.StudentId == studentId, ct);

        if (streak == null)
        {
            streak = new StudentStreak { StudentId = studentId, LastActivityDate = today, CurrentStreak = 1 };
            db.StudentStreaks.Add(streak);
        }
        else if (streak.LastActivityDate == today)
        {
            // Already recorded today — just check badges
        }
        else
        {
            var yesterday = today.AddDays(-1);
            streak.CurrentStreak = streak.LastActivityDate == yesterday
                ? streak.CurrentStreak + 1
                : 1; // streak broken

            streak.LastActivityDate = today;
            streak.MaxStreak = Math.Max(streak.MaxStreak, streak.CurrentStreak);
        }

        // Award coins + XP per activity
        int coins = activityType switch
        {
            "homework_passed" => 15,
            "test_passed" => 20,
            "homework_submitted" => 5,
            "lesson_viewed" => 2,
            _ => 1
        };
        int xp = activityType switch
        {
            "homework_passed" => 30,
            "test_passed" => 50,
            "homework_submitted" => 10,
            "lesson_viewed" => 5,
            _ => 2
        };
        streak.TotalCoins += coins;
        streak.TotalXp    += xp;

        await db.SaveChangesAsync(ct);
        await CheckAndAwardBadgesAsync(studentId, streak, ct);
    }

    public async Task<StudentProgressDto> GetProgressAsync(Guid studentId, CancellationToken ct = default)
    {
        var streak = await db.StudentStreaks
            .FirstOrDefaultAsync(s => s.StudentId == studentId, ct)
            ?? new StudentStreak { StudentId = studentId };

        var allBadges = await db.Badges.ToListAsync(ct);
        var earnedBadges = await db.StudentBadges
            .Include(sb => sb.Badge)
            .Where(sb => sb.StudentId == studentId)
            .ToListAsync(ct);

        var earnedIds = earnedBadges.Select(sb => sb.BadgeId).ToHashSet();

        var badgeDtos = allBadges.Select(b =>
        {
            var earned = earnedBadges.FirstOrDefault(sb => sb.BadgeId == b.Id);
            return new BadgeDto(
                b.Id, b.Name, b.Description, b.Icon,
                b.Condition, b.ConditionValue, b.CoinsReward,
                earnedIds.Contains(b.Id),
                earned?.EarnedAt);
        }).ToList();

        var (level, title, color) = StudentStreak.GetLevel(streak.TotalXp);
        int[] xpThresholds = [0, 100, 300, 700, 1500, int.MaxValue];
        int xpToNext = level < 5 ? xpThresholds[level] - streak.TotalXp : 0;

        return new StudentProgressDto(
            streak.CurrentStreak,
            streak.MaxStreak,
            streak.TotalCoins,
            streak.LastActivityDate,
            badgeDtos.Where(b => b.IsEarned).ToList(),
            badgeDtos,
            streak.TotalXp,
            level,
            title,
            color,
            xpToNext
        );
    }

    public async Task SpendCoinsAsync(Guid studentId, int amount, CancellationToken ct = default)
    {
        var streak = await db.StudentStreaks
            .FirstOrDefaultAsync(s => s.StudentId == studentId, ct)
            ?? throw new InvalidOperationException("Запис гравця не знайдено");

        if (streak.TotalCoins < amount)
            throw new InvalidOperationException("Недостатньо монет");

        streak.TotalCoins -= amount;
        await db.SaveChangesAsync(ct);
    }

    private async Task CheckAndAwardBadgesAsync(Guid studentId, StudentStreak streak, CancellationToken ct)
    {
        var allBadges = await db.Badges.ToListAsync(ct);
        var earnedIdsList = await db.StudentBadges
            .Where(sb => sb.StudentId == studentId)
            .Select(sb => sb.BadgeId)
            .ToListAsync(ct);
        var earnedIds = earnedIdsList.ToHashSet();

        var hwPassed = await db.HomeworkSubmissions
            .CountAsync(s => s.StudentId == studentId && s.Status == Domain.Enums.HomeworkStatus.Passed, ct);
        var testsPassed = await db.TestAttempts
            .CountAsync(a => a.StudentId == studentId && a.Passed, ct);

        foreach (var badge in allBadges.Where(b => !earnedIds.Contains(b.Id)))
        {
            bool earned = badge.Condition switch
            {
                "streak" => streak.CurrentStreak >= badge.ConditionValue,
                "max_streak" => streak.MaxStreak >= badge.ConditionValue,
                "homeworks_passed" => hwPassed >= badge.ConditionValue,
                "tests_passed" => testsPassed >= badge.ConditionValue,
                "coins" => streak.TotalCoins >= badge.ConditionValue,
                _ => false
            };

            if (!earned) continue;

            db.StudentBadges.Add(new StudentBadge { StudentId = studentId, BadgeId = badge.Id });
            streak.TotalCoins += badge.CoinsReward;
        }

        await db.SaveChangesAsync(ct);
    }
}

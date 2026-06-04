namespace LTropik.Application.Interfaces;

public record StudentProgressDto(
    int CurrentStreak,
    int MaxStreak,
    int TotalCoins,
    DateOnly LastActivityDate,
    List<BadgeDto> EarnedBadges,
    List<BadgeDto> AllBadges,
    int TotalXp = 0,
    int Level = 1,
    string LevelTitle = "Новачок",
    string LevelColor = "#9ca3af",
    int XpToNextLevel = 100
);

public record BadgeDto(
    Guid Id,
    string Name,
    string Description,
    string Icon,
    string Condition,
    int ConditionValue,
    int CoinsReward,
    bool IsEarned,
    DateTimeOffset? EarnedAt
);

public interface IGamificationService
{
    Task RecordActivityAsync(Guid studentId, string activityType, CancellationToken ct = default);
    Task<StudentProgressDto> GetProgressAsync(Guid studentId, CancellationToken ct = default);
    Task SpendCoinsAsync(Guid studentId, int amount, CancellationToken ct = default);
}

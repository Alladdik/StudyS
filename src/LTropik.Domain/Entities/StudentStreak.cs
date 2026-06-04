namespace LTropik.Domain.Entities;

public class StudentStreak
{
    public Guid StudentId { get; set; }
    public int CurrentStreak { get; set; } = 0;
    public int MaxStreak { get; set; } = 0;
    public DateOnly LastActivityDate { get; set; }
    public int TotalCoins { get; set; } = 0;
    public int TotalXp { get; set; } = 0;

    public User Student { get; set; } = null!;

    // Рівень на основі XP
    public static (int level, string title, string color) GetLevel(int xp) => xp switch
    {
        < 100  => (1, "Новачок",  "#9ca3af"),
        < 300  => (2, "Учень",    "#3b82f6"),
        < 700  => (3, "Знавець",  "#8b5cf6"),
        < 1500 => (4, "Майстер",  "#f59e0b"),
        _      => (5, "Легенда",  "#ef4444"),
    };
}

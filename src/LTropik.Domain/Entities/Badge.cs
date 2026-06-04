namespace LTropik.Domain.Entities;

public class Badge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty; // emoji or icon key
    public string Condition { get; set; } = string.Empty; // "streak_7", "homeworks_10", "tests_5"
    public int ConditionValue { get; set; }
    public int CoinsReward { get; set; } = 0;

    public ICollection<StudentBadge> StudentBadges { get; set; } = [];
}

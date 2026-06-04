namespace LTropik.Domain.Entities;

public class DailyQuest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    // login | submit_homework | view_lesson
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "⭐";
    public int CoinsReward { get; set; } = 10;
    public bool IsActive { get; set; } = true;

    public ICollection<StudentDailyQuest> StudentQuests { get; set; } = [];
}

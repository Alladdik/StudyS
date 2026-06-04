namespace LTropik.Domain.Entities;

public class StudentDailyQuest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid QuestId { get; set; }
    public DateOnly Date { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public User Student { get; set; } = null!;
    public DailyQuest Quest { get; set; } = null!;
}

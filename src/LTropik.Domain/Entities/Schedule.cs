namespace LTropik.Domain.Entities;

public class Schedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public Guid TeacherId { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public string? Notes { get; set; }

    public Lesson Lesson { get; set; } = null!;
    public User Teacher { get; set; } = null!;
}

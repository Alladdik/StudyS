namespace LTropik.Domain.Entities;

public class CourseProgress
{
    public Guid StudentId { get; set; }
    public Guid LessonId { get; set; }
    public DateTimeOffset CompletedAt { get; set; } = DateTimeOffset.UtcNow;

    public User Student { get; set; } = null!;
    public Lesson Lesson { get; set; } = null!;
}

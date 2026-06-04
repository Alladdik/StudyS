namespace LTropik.Domain.Entities;

public class LessonNote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid LessonId  { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public User   Student { get; set; } = null!;
    public Lesson Lesson  { get; set; } = null!;
}

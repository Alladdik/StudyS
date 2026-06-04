namespace LTropik.Domain.Entities;

public class LessonRecording
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public Guid TeacherId { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? Title { get; set; }
    public long FileSizeBytes { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public Lesson Lesson { get; set; } = null!;
    public User Teacher { get; set; } = null!;
}

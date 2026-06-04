using System.Text.Json;

namespace LTropik.Domain.Entities;

public class Test
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int TimeLimitMinutes { get; set; } = 0;
    public int MaxAttempts { get; set; } = 1;
    public decimal PassingPercentage { get; set; } = 60;
    public JsonDocument Questions { get; set; } = JsonDocument.Parse("[]");
    public string? AllowedStudentIds { get; set; } = string.Empty;

    public Lesson Lesson { get; set; } = null!;
    public ICollection<TestAttempt> Attempts { get; set; } = [];
}

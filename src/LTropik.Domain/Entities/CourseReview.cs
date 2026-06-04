namespace LTropik.Domain.Entities;

public class CourseReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }
    public Guid StudentId { get; set; }
    public int Rating { get; set; } // 1-5
    public string? Comment { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Course Course { get; set; } = null!;
    public User Student { get; set; } = null!;
}

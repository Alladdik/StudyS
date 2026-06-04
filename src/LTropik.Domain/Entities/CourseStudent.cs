namespace LTropik.Domain.Entities;

public class CourseStudent
{
    public Guid CourseId { get; set; }
    public Guid StudentId { get; set; }
    public int BalanceLessons { get; set; } = 0;
    public DateTimeOffset? SubscriptionEndsAt { get; set; }

    public Course Course { get; set; } = null!;
    public User Student { get; set; } = null!;
}

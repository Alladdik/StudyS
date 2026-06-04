namespace LTropik.Domain.Entities;

public class StudentBadge
{
    public Guid StudentId { get; set; }
    public Guid BadgeId { get; set; }
    public DateTimeOffset EarnedAt { get; set; } = DateTimeOffset.UtcNow;

    public User Student { get; set; } = null!;
    public Badge Badge { get; set; } = null!;
}

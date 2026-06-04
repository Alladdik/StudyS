namespace LTropik.Domain.Entities;

public enum EnrollmentRequestStatus { Pending, Approved, Rejected }

public class EnrollmentRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }
    public Guid StudentId { get; set; }
    public EnrollmentRequestStatus Status { get; set; } = EnrollmentRequestStatus.Pending;
    public string? Message { get; set; }
    public string? ResponseNote { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReviewedAt { get; set; }

    public Course Course { get; set; } = null!;
    public User Student { get; set; } = null!;
}

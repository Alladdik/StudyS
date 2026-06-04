using LTropik.Domain.Enums;

namespace LTropik.Domain.Entities;

public class HomeworkSubmission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HomeworkId { get; set; }
    public Guid StudentId { get; set; }
    public HomeworkStatus Status { get; set; } = HomeworkStatus.NotStarted;
    public string? SubmissionData { get; set; }
    public string? AiFeedbackDraft { get; set; }
    public string? TeacherFeedback { get; set; }
    public Guid? GradeValueId { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Homework Homework { get; set; } = null!;
    public User Student { get; set; } = null!;
    public GradeScaleValue? GradeValue { get; set; }
}

namespace LTropik.Domain.Entities;

public class Course
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? GradeScaleId { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public GradeScale? GradeScale { get; set; }
    public ICollection<Module> Modules { get; set; } = [];
    public ICollection<CourseTeacher> Teachers { get; set; } = [];
    public ICollection<CourseStudent> Students { get; set; } = [];
    public ICollection<PaymentTransaction> Transactions { get; set; } = [];
    public ICollection<CourseReview> Reviews { get; set; } = [];
}

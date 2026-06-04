using LTropik.Domain.Enums;

namespace LTropik.Domain.Entities;

public class AttendanceAndGrade
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid LessonId { get; set; }
    public AttendanceStatus Attendance { get; set; } = AttendanceStatus.Present;
    public Guid? GradeId { get; set; }
    public DateOnly LessonDate { get; set; }

    public User Student { get; set; } = null!;
    public Lesson Lesson { get; set; } = null!;
    public GradeScaleValue? Grade { get; set; }
}

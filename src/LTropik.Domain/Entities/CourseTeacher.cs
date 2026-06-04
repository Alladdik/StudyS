namespace LTropik.Domain.Entities;

public class CourseTeacher
{
    public Guid CourseId { get; set; }
    public Guid TeacherId { get; set; }

    public Course Course { get; set; } = null!;
    public User Teacher { get; set; } = null!;
}

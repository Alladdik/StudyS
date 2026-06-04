namespace LTropik.Domain.Entities;

public class GradeScale
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;

    public ICollection<GradeScaleValue> Values { get; set; } = [];
    public ICollection<Course> Courses { get; set; } = [];
}

namespace LTropik.Domain.Entities;

public class ParentStudent
{
    public Guid ParentId { get; set; }
    public Guid StudentId { get; set; }

    public User Parent { get; set; } = null!;
    public User Student { get; set; } = null!;
}

namespace LTropik.Domain.Entities;

public class GroupMember
{
    public Guid GroupId { get; set; }
    public Guid StudentId { get; set; }

    public StudentGroup Group { get; set; } = null!;
    public User Student { get; set; } = null!;
}

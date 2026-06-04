namespace LTropik.Domain.Entities;

public class Room
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public Guid HostId { get; set; }
    public Guid? CourseId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public User Host { get; set; } = null!;
    public Course? Course { get; set; }
    public ICollection<RoomMessage> Messages { get; set; } = [];
}

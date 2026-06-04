namespace LTropik.Domain.Entities;

public class RoomMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoomId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;

    public Room Room { get; set; } = null!;
    public User User { get; set; } = null!;
}

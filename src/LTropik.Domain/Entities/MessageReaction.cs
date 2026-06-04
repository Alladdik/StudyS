namespace LTropik.Domain.Entities;

public class MessageReaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    // Belongs to either DirectMessage or RoomMessage (nullable FK pattern)
    public Guid? DirectMessageId { get; set; }
    public Guid? RoomMessageId { get; set; }
    public Guid UserId { get; set; }
    public string Emoji { get; set; } = "👍"; // 👍 ❤️ 😂 😮 😢 🔥

    public User User { get; set; } = null!;
    public DirectMessage? DirectMessage { get; set; }
    public RoomMessage? RoomMessage { get; set; }
}

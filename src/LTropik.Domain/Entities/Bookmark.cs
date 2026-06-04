namespace LTropik.Domain.Entities;

public class Bookmark
{
    public Guid Id        { get; set; } = Guid.NewGuid();
    public Guid UserId    { get; set; }
    public string Type    { get; set; } = "lesson"; // "lesson" | "course"
    public Guid RefId     { get; set; }
    public string? Title  { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public User User { get; set; } = null!;
}

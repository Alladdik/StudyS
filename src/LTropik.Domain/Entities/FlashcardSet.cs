namespace LTropik.Domain.Entities;

public class FlashcardSet
{
    public Guid Id        { get; set; } = Guid.NewGuid();
    public Guid UserId    { get; set; }
    public Guid? LessonId { get; set; }
    public string Title   { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public User              User      { get; set; } = null!;
    public Lesson?           Lesson    { get; set; }
    public ICollection<Flashcard> Cards { get; set; } = [];
}

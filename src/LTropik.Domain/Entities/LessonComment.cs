namespace LTropik.Domain.Entities;

public class LessonComment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public Guid AuthorId { get; set; }
    public Guid? ParentCommentId { get; set; }
    public string Body { get; set; } = string.Empty;
    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Lesson Lesson { get; set; } = null!;
    public User Author { get; set; } = null!;
    public LessonComment? ParentComment { get; set; }
    public ICollection<LessonComment> Replies { get; set; } = [];
}

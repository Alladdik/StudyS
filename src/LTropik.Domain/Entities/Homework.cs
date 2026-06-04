namespace LTropik.Domain.Entities;

public class Homework
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public string Instruction { get; set; } = string.Empty;
    public DateTimeOffset? DueDate { get; set; }
    public bool ReminderSent { get; set; } = false;

    public Lesson Lesson { get; set; } = null!;
    public ICollection<HomeworkSubmission> Submissions { get; set; } = [];
}

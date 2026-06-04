namespace LTropik.Domain.Entities;

public class Flashcard
{
    public Guid Id       { get; set; } = Guid.NewGuid();
    public Guid SetId    { get; set; }
    public string Front  { get; set; } = string.Empty;
    public string Back   { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public FlashcardSet Set { get; set; } = null!;
}

using System.Text.Json;

namespace LTropik.Domain.Entities;

public class QuestionBankItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Text { get; set; } = string.Empty;
    public string Type { get; set; } = "Single"; // Single, Multi, Text
    public JsonDocument Options { get; set; } = JsonDocument.Parse("[]");
    public string? Tags { get; set; }
    public string? Category { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

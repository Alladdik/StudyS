using System.Text.Json;

namespace LTropik.Domain.Entities;

public class TestAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TestId { get; set; }
    public Guid StudentId { get; set; }
    public decimal ScorePercentage { get; set; }
    public bool Passed { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
    public JsonDocument AnswersJson { get; set; } = JsonDocument.Parse("{}");

    public Test Test { get; set; } = null!;
    public User Student { get; set; } = null!;
}

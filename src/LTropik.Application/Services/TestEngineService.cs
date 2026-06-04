using System.Text.Json;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LTropik.Application.Services;

public class TestEngineService(IApplicationDbContext db) : ITestEngineService
{
    public async Task<SubmitTestResult> SubmitAsync(SubmitTestRequest request, CancellationToken ct)
    {
        var test = await db.Tests
            .FirstOrDefaultAsync(t => t.Id == request.TestId, ct)
            ?? throw new KeyNotFoundException("Тест не знайдено");

        // Server-side time validation
        var latestAttempt = await db.TestAttempts
            .Where(a => a.TestId == request.TestId && a.StudentId == request.StudentId && a.FinishedAt == null)
            .OrderByDescending(a => a.StartedAt)
            .FirstOrDefaultAsync(ct);

        if (latestAttempt != null && test.TimeLimitMinutes > 0)
        {
            var deadline = latestAttempt.StartedAt.AddMinutes(test.TimeLimitMinutes);
            if (DateTimeOffset.UtcNow > deadline)
            {
                // Time expired - record 0 score
                latestAttempt.ScorePercentage = 0;
                latestAttempt.Passed = false;
                latestAttempt.FinishedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
                return new SubmitTestResult(0, false, latestAttempt.Id);
            }
        }

        var questions = JsonSerializer.Deserialize<List<QuestionSchema>>(
            test.Questions.RootElement.GetRawText())
            ?? [];

        int totalPoints = questions.Count;
        int earned = 0;

        foreach (var question in questions)
        {
            if (!request.Answers.TryGetValue(question.Id, out var answerObj))
                continue;

            earned += question.Type switch
            {
                "single" => CheckSingle(answerObj, question),
                "multiple" => CheckMultiple(answerObj, question),
                "text" => CheckText(answerObj, question),
                _ => 0
            };
        }

        decimal score = totalPoints > 0 ? Math.Round((decimal)earned / totalPoints * 100, 2) : 0;
        bool passed = score >= test.PassingPercentage;

        var attempt = latestAttempt ?? new TestAttempt
        {
            TestId = request.TestId,
            StudentId = request.StudentId,
            StartedAt = DateTimeOffset.UtcNow
        };

        attempt.ScorePercentage = score;
        attempt.Passed = passed;
        attempt.FinishedAt = DateTimeOffset.UtcNow;

        if (latestAttempt == null)
            db.TestAttempts.Add(attempt);

        await db.SaveChangesAsync(ct);

        return new SubmitTestResult(score, passed, attempt.Id);
    }

    public async Task<int> GetRemainingAttemptsAsync(Guid testId, Guid studentId, CancellationToken ct)
    {
        var test = await db.Tests.FindAsync([testId], ct)
            ?? throw new KeyNotFoundException("Тест не знайдено");

        int used = await db.TestAttempts
            .CountAsync(a => a.TestId == testId && a.StudentId == studentId && a.FinishedAt != null, ct);

        return Math.Max(0, test.MaxAttempts - used);
    }

    private static int CheckSingle(object answer, QuestionSchema q)
    {
        var given = answer?.ToString() ?? "";
        return given.Equals(q.CorrectAnswer, StringComparison.OrdinalIgnoreCase) ? 1 : 0;
    }

    private static int CheckMultiple(object answer, QuestionSchema q)
    {
        if (answer is not JsonElement el) return 0;
        var given = el.EnumerateArray().Select(x => x.GetString() ?? "").OrderBy(x => x).ToList();
        var correct = q.CorrectAnswers?.OrderBy(x => x).ToList() ?? [];
        return given.SequenceEqual(correct) ? 1 : 0;
    }

    private static int CheckText(object answer, QuestionSchema q)
    {
        var given = answer?.ToString()?.Trim() ?? "";
        return given.Equals(q.CorrectAnswer?.Trim(), StringComparison.OrdinalIgnoreCase) ? 1 : 0;
    }

    private record QuestionSchema(string Id, string Type, string Text, string? CorrectAnswer, List<string>? CorrectAnswers);
}

namespace LTropik.Application.Interfaces;

public record SubmitTestRequest(
    Guid TestId,
    Guid StudentId,
    Dictionary<string, object> Answers
);

public record SubmitTestResult(
    decimal ScorePercentage,
    bool Passed,
    Guid AttemptId
);

public interface ITestEngineService
{
    Task<SubmitTestResult> SubmitAsync(SubmitTestRequest request, CancellationToken ct = default);
    Task<int> GetRemainingAttemptsAsync(Guid testId, Guid studentId, CancellationToken ct = default);
}

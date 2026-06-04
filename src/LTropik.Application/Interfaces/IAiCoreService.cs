namespace LTropik.Application.Interfaces;

public interface IAiCoreService
{
    Task GenerateHomeworkReviewDraftAsync(Guid submissionId, CancellationToken ct = default);
    Task<string> GenerateQuizFromTextAsync(string sourceText, CancellationToken ct = default);
    Task<string> GetTutorResponseAsync(Guid courseId, string studentQuestion, IEnumerable<string> history, CancellationToken ct = default);
}

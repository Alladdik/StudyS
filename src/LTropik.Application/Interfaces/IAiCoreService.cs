namespace LTropik.Application.Interfaces;

public interface IAiCoreService
{
    Task GenerateHomeworkReviewDraftAsync(Guid submissionId, CancellationToken ct = default);
    Task<string> GenerateQuizFromTextAsync(string sourceText, CancellationToken ct = default);
    Task<string> GetTutorResponseAsync(Guid courseId, string studentQuestion, IEnumerable<string> history, CancellationToken ct = default);
    Task<TestBuilderReply> TestBuilderChatAsync(IEnumerable<ChatTurn> history, CancellationToken ct = default);
}

public record ChatTurn(string Role, string Content);   // role: "user" | "assistant"
public record TestBuilderReply(string Message, string? QuestionsJson);

namespace LTropik.Application.DTOs;

public record TestQuestionDto(
    string Id,
    string Type, // "single", "multiple", "text"
    string Text,
    List<TestOptionDto>? Options,
    string? CorrectAnswer
);

public record TestOptionDto(string Id, string Text);

// Public-facing DTO — correct answers are intentionally excluded
public record TestQuestionPublicDto(
    string Id,
    string Type,
    string Text,
    List<TestOptionDto>? Options
);

public record TestInfoDto(
    Guid Id,
    string Title,
    int TimeLimitMinutes,
    int MaxAttempts,
    decimal PassingPercentage,
    List<TestQuestionPublicDto> Questions
);

public record CreateTestRequest(
    string Title,
    int TimeLimitMinutes,
    int MaxAttempts,
    decimal PassingPercentage,
    List<TestQuestionDto> Questions
);

public record StartTestResponse(Guid AttemptId, DateTimeOffset ServerStartTime, int TimeLimitMinutes);

public record SubmitAnswersRequest(Guid AttemptId, Dictionary<string, object> Answers, Dictionary<string, int>? QuestionTimes);

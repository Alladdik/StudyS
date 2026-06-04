namespace LTropik.Application.DTOs;

public record LessonCommentDto(
    Guid Id,
    Guid AuthorId,
    string AuthorName,
    string Body,
    Guid? ParentCommentId,
    DateTimeOffset CreatedAt,
    IReadOnlyList<LessonCommentDto> Replies);

public record CreateCommentRequest(Guid LessonId, string Body, Guid? ParentCommentId);

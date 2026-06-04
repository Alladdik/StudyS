namespace LTropik.Application.DTOs;

public record CreateCourseRequest(string Title, string? Description, Guid? GradeScaleId);

public record UpdateCourseRequest(string? Title, string? Description, Guid? GradeScaleId);

public record CourseDto(
    Guid Id,
    string Title,
    string? Description,
    Guid? GradeScaleId,
    string? GradeScaleName,
    string Status,
    DateTimeOffset CreatedAt
);

public record CreateModuleRequest(string Title, int SortOrder);

public record ModuleDto(Guid Id, Guid CourseId, string Title, int SortOrder, List<LessonDto> Lessons);

public record ContentBlockDto(string Type, Dictionary<string, object> Data);

public record CreateLessonRequest(string Title, int SortOrder, List<ContentBlockDto> ContentBlocks);

public record LessonDto(Guid Id, Guid ModuleId, string Title, int SortOrder, List<ContentBlockDto> ContentBlocks);

namespace LTropik.Application.DTOs;

public record CourseProgressDto(
    Guid CourseId,
    string CourseTitle,
    int TotalLessons,
    int CompletedLessons,
    double ProgressPercent,
    Guid[] CompletedLessonIds);

public record MarkLessonCompleteRequest(Guid LessonId);

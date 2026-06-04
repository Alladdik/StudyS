namespace LTropik.Application.DTOs;

public record ScheduleEntryDto(
    Guid Id,
    Guid LessonId,
    string LessonTitle,
    string CourseTitle,
    Guid TeacherId,
    string TeacherName,
    DateTimeOffset StartsAt,
    int DurationMinutes,
    string? Notes,
    Guid CourseId);

public record CreateScheduleRequest(
    Guid LessonId,
    DateTimeOffset StartsAt,
    int DurationMinutes,
    string? Notes,
    Guid? TeacherId);

public record UpdateScheduleRequest(
    DateTimeOffset? StartsAt,
    int? DurationMinutes,
    string? Notes,
    Guid? TeacherId);

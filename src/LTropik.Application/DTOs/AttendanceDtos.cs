using LTropik.Domain.Enums;

namespace LTropik.Application.DTOs;

public record SetAttendanceRequest(
    Guid LessonId,
    DateOnly LessonDate,
    List<StudentAttendanceItem> Records
);

public record StudentAttendanceItem(
    Guid StudentId,
    AttendanceStatus Attendance,
    Guid? GradeId
);

public record BulkMarkPresentRequest(Guid LessonId, DateOnly LessonDate);

public record JournalEntryDto(
    Guid StudentId,
    string StudentName,
    AttendanceStatus Attendance,
    string? GradeValue,
    DateOnly LessonDate
);

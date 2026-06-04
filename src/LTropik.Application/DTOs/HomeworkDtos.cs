using LTropik.Domain.Enums;

namespace LTropik.Application.DTOs;

public record SubmitHomeworkRequest(Guid HomeworkId, string SubmissionData);

public record HomeworkSubmissionDto(
    Guid Id,
    Guid HomeworkId,
    Guid StudentId,
    string StudentName,
    HomeworkStatus Status,
    string? SubmissionData,
    string? AiFeedbackDraft,
    string? TeacherFeedback,
    string? GradeValue,
    DateTimeOffset UpdatedAt
);

public record ReviewHomeworkRequest(
    Guid SubmissionId,
    string TeacherFeedback,
    Guid? GradeValueId,
    HomeworkStatus Status
);

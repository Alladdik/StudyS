using System.Security.Claims;
using LTropik.Application.Authorization;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.Domain.Enums;
using LTropik.Infrastructure.BackgroundServices;
using LTropik.WebAPI.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HomeworksController(
    IApplicationDbContext db,
    AiReviewChannel aiChannel,
    INotificationService notificationService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // A teacher may only touch homework belonging to a course they actually teach.
    private Task<bool> TeacherOwnsCourse(Guid courseId, CancellationToken ct) =>
        db.TeacherOwnsCourseAsync(courseId, CurrentUserId, ct);

    [HttpPost("submit")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Submit(SubmitHomeworkRequest req, CancellationToken ct)
    {
        var homework = await db.Homeworks
            .Include(h => h.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .FirstOrDefaultAsync(h => h.Id == req.HomeworkId, ct);

        if (homework == null) return NotFound();

        var existing = await db.HomeworkSubmissions
            .FirstOrDefaultAsync(s => s.HomeworkId == req.HomeworkId && s.StudentId == CurrentUserId, ct);

        if (existing != null)
        {
            existing.SubmissionData = req.SubmissionData;
            existing.Status = HomeworkStatus.OnReview;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            existing = new HomeworkSubmission
            {
                HomeworkId = req.HomeworkId,
                StudentId = CurrentUserId,
                SubmissionData = req.SubmissionData,
                Status = HomeworkStatus.OnReview
            };
            db.HomeworkSubmissions.Add(existing);
        }

        await db.SaveChangesAsync(ct);

        // Find teacher for this course (nullable — some courses have no teacher yet)
        var teacherId = await db.CourseTeachers
            .Where(ct2 => ct2.CourseId == homework.Lesson.Module.CourseId)
            .Select(ct2 => (Guid?)ct2.TeacherId)
            .FirstOrDefaultAsync(ct);

        var student = await db.Users.FindAsync([CurrentUserId], ct);
        var studentName = $"{student?.FirstName} {student?.LastName}";

        // Queue AI review only when there is an assigned teacher
        if (teacherId.HasValue)
            await aiChannel.Writer.WriteAsync(new AiReviewJob(existing.Id, teacherId.Value, studentName), ct);

        return Accepted(new { submissionId = existing.Id });
    }

    [HttpGet("queue")]
    [Authorize(Roles = "Teacher,Admin,Manager")]
    public async Task<IActionResult> GetReviewQueue([FromQuery] Guid courseId, CancellationToken ct)
    {
        // Teachers are limited to their own courses; admins/managers see any course.
        if (User.IsInRole("Teacher") && !await TeacherOwnsCourse(courseId, ct))
            return Forbid();

        var submissions = await db.HomeworkSubmissions
            .Include(s => s.Student)
            .Include(s => s.GradeValue)
            .Where(s => s.Status == HomeworkStatus.OnReview &&
                        s.Homework.Lesson.Module.CourseId == courseId)
            .OrderBy(s => s.UpdatedAt)
            .Select(s => new HomeworkSubmissionDto(
                s.Id, s.HomeworkId, s.StudentId,
                s.Student.FirstName + " " + s.Student.LastName,
                s.Status, s.SubmissionData,
                s.AiFeedbackDraft, s.TeacherFeedback,
                s.GradeValue != null ? s.GradeValue.ValueString : null,
                s.UpdatedAt))
            .ToListAsync(ct);

        return Ok(submissions);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var s = await db.HomeworkSubmissions
            .Include(x => x.Student)
            .Include(x => x.GradeValue)
            .Include(x => x.Homework).ThenInclude(h => h.Lesson).ThenInclude(l => l.Module)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (s == null) return NotFound();

        // Security: students read only their own; parents cannot read submissions;
        // teachers only within courses they teach (admins unrestricted).
        if (User.IsInRole("Student") && s.StudentId != CurrentUserId) return Forbid();
        if (User.IsInRole("Parent")) return Forbid();
        if (User.IsInRole("Teacher") && !await TeacherOwnsCourse(s.Homework.Lesson.Module.CourseId, ct))
            return Forbid();

        return Ok(new
        {
            s.Id, s.HomeworkId, s.StudentId,
            StudentName = s.Student.FirstName + " " + s.Student.LastName,
            Status = s.Status.ToString(),
            s.SubmissionData, s.AiFeedbackDraft, s.TeacherFeedback,
            GradeValue = s.GradeValue?.ValueString,
            s.UpdatedAt
        });
    }

    // Student: get homework detail with their submission
    [HttpGet("{id:guid}/detail")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetDetail(Guid id, CancellationToken ct)
    {
        var hw = await db.Homeworks.FindAsync([id], ct);
        if (hw == null) return NotFound();

        var submission = await db.HomeworkSubmissions
            .Include(s => s.GradeValue)
            .FirstOrDefaultAsync(s => s.HomeworkId == id && s.StudentId == CurrentUserId, ct);

        return Ok(new
        {
            hw.Id,
            hw.LessonId,
            hw.Instruction,
            ExistingSubmission = submission == null ? null : new
            {
                submission.Id,
                Status = submission.Status.ToString(),
                submission.SubmissionData,
                submission.TeacherFeedback,
                submission.AiFeedbackDraft,
                GradeValue = submission.GradeValue?.ValueString
            }
        });
    }

    [HttpPut("{id:guid}/review")]
    [Authorize(Roles = "Teacher,Admin")]
    [Audit("HomeworkReviewed")]
    public async Task<IActionResult> Review(Guid id, ReviewHomeworkRequest req, CancellationToken ct)
    {
        var submission = await db.HomeworkSubmissions
            .Include(s => s.Homework).ThenInclude(h => h.Lesson).ThenInclude(l => l.Module)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
        if (submission == null) return NotFound();

        // Teachers may only grade homework in courses they teach (admins unrestricted).
        if (User.IsInRole("Teacher") && !await TeacherOwnsCourse(submission.Homework.Lesson.Module.CourseId, ct))
            return Forbid();

        submission.TeacherFeedback = req.TeacherFeedback;
        submission.GradeValueId = req.GradeValueId;
        submission.Status = req.Status;
        submission.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        // In-app notification
        await notificationService.SendAsync(
            submission.StudentId, "HomeworkReviewed",
            "ДЗ перевірено", $"Ваше домашнє завдання перевірено. Статус: {req.Status}",
            ct: ct);

        // Notify student via Telegram
        if (req.GradeValueId.HasValue)
        {
            var grade = await db.GradeScaleValues.FindAsync([req.GradeValueId.Value], ct);
            var homework = await db.Homeworks
                .Include(h => h.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
                .FirstOrDefaultAsync(h => h.Id == submission.HomeworkId, ct);

            if (grade != null && homework != null)
            {
                // Capture values before leaving request scope; no ct — must outlive the request
                var studentId = submission.StudentId;
                var gradeStr = grade.ValueString;
                var courseTitle = homework.Lesson.Module.Course.Title;
                var services = HttpContext.RequestServices;
                _ = Task.Run(async () =>
                {
                    using var scope = services.CreateScope();
                    var tg = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
                    await tg.NotifyGradeChangedAsync(studentId, gradeStr, courseTitle);
                });
            }
        }

        return Ok(submission);
    }
}

using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EnrollmentRequestsController(
    IApplicationDbContext db,
    INotificationService notifications) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Student: submit enrollment request
    [HttpPost]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Submit([FromBody] SubmitEnrollmentRequest req, CancellationToken ct)
    {
        if (await db.CourseStudents.AnyAsync(cs => cs.CourseId == req.CourseId && cs.StudentId == CurrentUserId, ct))
            return Conflict(new { error = "Ви вже записані на цей курс" });

        if (await db.EnrollmentRequests.AnyAsync(
            er => er.CourseId == req.CourseId && er.StudentId == CurrentUserId
               && er.Status == EnrollmentRequestStatus.Pending, ct))
            return Conflict(new { error = "Заявка вже подана — очікуйте підтвердження" });

        db.EnrollmentRequests.Add(new EnrollmentRequest
        {
            CourseId  = req.CourseId,
            StudentId = CurrentUserId,
            Message   = req.Message
        });
        await db.SaveChangesAsync(ct);

        // Notify teachers of this course
        var teacherIds = await db.CourseTeachers
            .Where(ct2 => ct2.CourseId == req.CourseId)
            .Select(ct2 => ct2.TeacherId)
            .ToListAsync(ct);

        var student   = await db.Users.FindAsync([CurrentUserId], ct);
        var courseName = await db.Courses.Where(c => c.Id == req.CourseId).Select(c => c.Title).FirstOrDefaultAsync(ct) ?? "";
        var name       = student != null ? $"{student.FirstName} {student.LastName}" : "Студент";

        foreach (var tid in teacherIds)
            await notifications.SendAsync(tid, "EnrollmentRequest",
                "Нова заявка", $"{name} хоче записатись на «{courseName}»",
                "/admin/courses", ct);

        return Ok(new { message = "Заявку подано. Очікуйте підтвердження." });
    }

    // Admin/Teacher: list pending requests for a course
    [HttpGet]
    [Authorize(Roles = "Admin,Teacher,Manager")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? courseId, CancellationToken ct)
    {
        var query = db.EnrollmentRequests
            .Include(er => er.Student)
            .Include(er => er.Course)
            .AsQueryable();

        if (courseId.HasValue)
            query = query.Where(er => er.CourseId == courseId);

        // Teachers only see their own courses
        if (User.IsInRole("Teacher"))
        {
            var userId = CurrentUserId;
            query = query.Where(er => db.CourseTeachers.Any(ct2 => ct2.CourseId == er.CourseId && ct2.TeacherId == userId));
        }

        var list = await query
            .OrderByDescending(er => er.CreatedAt)
            .Select(er => new
            {
                er.Id,
                er.Status,
                er.Message,
                er.ResponseNote,
                er.CreatedAt,
                er.ReviewedAt,
                CourseId    = er.CourseId,
                CourseTitle = er.Course.Title,
                StudentId   = er.StudentId,
                StudentName = er.Student.FirstName + " " + er.Student.LastName,
                StudentEmail = er.Student.Email
            })
            .ToListAsync(ct);

        return Ok(list);
    }

    // Admin/Teacher: approve
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin,Teacher,Manager")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewNoteRequest req, CancellationToken ct)
    {
        var er = await db.EnrollmentRequests.FindAsync([id], ct);
        if (er == null) return NotFound();

        // Teachers can only act on their own courses
        if (User.IsInRole("Teacher") &&
            !await db.CourseTeachers.AnyAsync(ct2 => ct2.CourseId == er.CourseId && ct2.TeacherId == CurrentUserId, ct))
            return Forbid();

        er.Status       = EnrollmentRequestStatus.Approved;
        er.ResponseNote = req.Note;
        er.ReviewedAt   = DateTimeOffset.UtcNow;

        // Actually enroll the student
        if (!await db.CourseStudents.AnyAsync(cs => cs.CourseId == er.CourseId && cs.StudentId == er.StudentId, ct))
            db.CourseStudents.Add(new CourseStudent { CourseId = er.CourseId, StudentId = er.StudentId });

        await db.SaveChangesAsync(ct);

        var courseName = await db.Courses.Where(c => c.Id == er.CourseId).Select(c => c.Title).FirstOrDefaultAsync(ct) ?? "";
        await notifications.SendAsync(er.StudentId, "EnrollmentApproved",
            "Заявку прийнято", $"Вас зараховано на курс «{courseName}»", "/student/courses", ct);

        return Ok();
    }

    // Admin/Teacher: reject
    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin,Teacher,Manager")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewNoteRequest req, CancellationToken ct)
    {
        var er = await db.EnrollmentRequests.FindAsync([id], ct);
        if (er == null) return NotFound();

        // Teachers can only act on their own courses
        if (User.IsInRole("Teacher") &&
            !await db.CourseTeachers.AnyAsync(ct2 => ct2.CourseId == er.CourseId && ct2.TeacherId == CurrentUserId, ct))
            return Forbid();

        er.Status       = EnrollmentRequestStatus.Rejected;
        er.ResponseNote = req.Note;
        er.ReviewedAt   = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var courseName = await db.Courses.Where(c => c.Id == er.CourseId).Select(c => c.Title).FirstOrDefaultAsync(ct) ?? "";
        await notifications.SendAsync(er.StudentId, "EnrollmentRejected",
            "Заявку відхилено", $"Ваша заявка на «{courseName}» відхилена. {req.Note}", "/student/courses", ct);

        return Ok();
    }

    // Student: check own request status for a course
    [HttpGet("my/{courseId:guid}")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyStatus(Guid courseId, CancellationToken ct)
    {
        var er = await db.EnrollmentRequests
            .Where(e => e.CourseId == courseId && e.StudentId == CurrentUserId)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new { e.Status, e.ResponseNote, e.CreatedAt })
            .FirstOrDefaultAsync(ct);

        return Ok(er);
    }
}

public record SubmitEnrollmentRequest(Guid CourseId, string? Message);
public record ReviewNoteRequest(string? Note);

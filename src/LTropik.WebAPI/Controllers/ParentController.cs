using System.Security.Claims;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Parent,Admin")]
public class ParentController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Admin: link parent to student
    [HttpPost("link")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Link([FromBody] LinkParentRequest req, CancellationToken ct)
    {
        var parent = await db.Users.FindAsync([req.ParentId], ct);
        if (parent == null || parent.Role != UserRole.Parent) return BadRequest("Користувач не є батьком");

        var student = await db.Users.FindAsync([req.StudentId], ct);
        if (student == null || student.Role != UserRole.Student) return BadRequest("Користувач не є студентом");

        if (await db.ParentStudents.AnyAsync(ps => ps.ParentId == req.ParentId && ps.StudentId == req.StudentId, ct))
            return Conflict("Зв'язок вже існує");

        db.ParentStudents.Add(new ParentStudent { ParentId = req.ParentId, StudentId = req.StudentId });
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("link/{parentId:guid}/{studentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Unlink(Guid parentId, Guid studentId, CancellationToken ct)
    {
        var link = await db.ParentStudents
            .FirstOrDefaultAsync(ps => ps.ParentId == parentId && ps.StudentId == studentId, ct);
        if (link == null) return NotFound();

        db.ParentStudents.Remove(link);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // Get children list for current parent
    [HttpGet("children")]
    public async Task<IActionResult> GetChildren(CancellationToken ct)
    {
        var parentId = CurrentUserId;
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role == "Admin" && Request.Query.ContainsKey("parentId"))
            Guid.TryParse(Request.Query["parentId"], out parentId);

        var children = await db.ParentStudents
            .Where(ps => ps.ParentId == parentId)
            .Include(ps => ps.Student)
            .Select(ps => new
            {
                ps.Student.Id,
                ps.Student.FirstName,
                ps.Student.LastName,
                ps.Student.Email
            })
            .ToListAsync(ct);

        return Ok(children);
    }

    [HttpGet("children/{studentId:guid}/journal")]
    public async Task<IActionResult> GetJournal(Guid studentId, [FromQuery] Guid courseId, CancellationToken ct)
    {
        if (!await HasAccessAsync(studentId, ct)) return Forbid();

        var records = await db.AttendanceAndGrades
            .Include(a => a.Grade)
            .Include(a => a.Student)
            .Include(a => a.Lesson).ThenInclude(l => l.Module)
            .Where(a => a.StudentId == studentId && a.Lesson.Module.CourseId == courseId)
            .OrderByDescending(a => a.LessonDate)
            .Select(a => new JournalEntryDto(
                a.StudentId,
                a.Student.FirstName + " " + a.Student.LastName,
                a.Attendance,
                a.Grade != null ? a.Grade.ValueString : null,
                a.LessonDate))
            .ToListAsync(ct);

        return Ok(records);
    }

    [HttpGet("children/{studentId:guid}/courses")]
    public async Task<IActionResult> GetCourses(Guid studentId, CancellationToken ct)
    {
        if (!await HasAccessAsync(studentId, ct)) return Forbid();

        var courses = await db.CourseStudents
            .Where(cs => cs.StudentId == studentId)
            .Include(cs => cs.Course)
            .Select(cs => new CourseDto(
                cs.Course.Id, cs.Course.Title, cs.Course.Description,
                cs.Course.GradeScaleId, null, cs.Course.Status, cs.Course.CreatedAt))
            .ToListAsync(ct);

        return Ok(courses);
    }

    [HttpGet("children/{studentId:guid}/balance")]
    public async Task<IActionResult> GetBalance(Guid studentId, CancellationToken ct)
    {
        if (!await HasAccessAsync(studentId, ct)) return Forbid();

        var transactions = await db.PaymentTransactions
            .Where(t => t.StudentId == studentId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                t.Amount,
                t.Currency,
                t.Status,
                t.CreatedAt,
                CourseName = t.Course != null ? t.Course.Title : null
            })
            .ToListAsync(ct);

        return Ok(transactions);
    }

    [HttpGet("children/{studentId:guid}/upcoming")]
    public async Task<IActionResult> GetUpcoming(Guid studentId, CancellationToken ct)
    {
        if (!await HasAccessAsync(studentId, ct)) return Forbid();

        var schedules = await db.Schedules
            .Include(s => s.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Include(s => s.Teacher)
            .Where(s => s.Lesson.Module.Course.Students.Any(cs => cs.StudentId == studentId)
                        && s.StartsAt >= DateTimeOffset.UtcNow)
            .OrderBy(s => s.StartsAt)
            .Take(10)
            .Select(s => new ScheduleEntryDto(
                s.Id, s.LessonId, s.Lesson.Title,
                s.Lesson.Module.Course.Title,
                s.TeacherId, s.Teacher.FirstName + " " + s.Teacher.LastName,
                s.StartsAt, s.DurationMinutes, s.Notes,
                s.Lesson.Module.CourseId))
            .ToListAsync(ct);

        return Ok(schedules);
    }

    [HttpGet("children/{studentId:guid}/homeworks")]
    public async Task<IActionResult> GetHomeworks(Guid studentId, CancellationToken ct)
    {
        if (!await HasAccessAsync(studentId, ct)) return Forbid();

        var homeworks = await db.Homeworks
            .Include(h => h.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Where(h => h.Lesson.Module.Course.Students.Any(cs => cs.StudentId == studentId))
            .Select(h => new
            {
                h.Id,
                h.Instruction,
                h.DueDate,
                CourseTitle = h.Lesson.Module.Course.Title,
                Submission = h.Submissions
                    .Where(s => s.StudentId == studentId)
                    .Select(s => new { s.Status, GradeValue = s.GradeValue != null ? s.GradeValue.ValueString : null, s.UpdatedAt })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        var result = homeworks.Select(h => new
        {
            h.Id,
            Title    = h.Instruction.Length > 60 ? h.Instruction[..60] + "…" : h.Instruction,
            h.CourseTitle,
            DueDate  = h.DueDate,
            Status   = h.Submission == null ? "NotSubmitted" : h.Submission.Status.ToString(),
            Grade    = h.Submission?.GradeValue,
            SubmittedAt = h.Submission?.UpdatedAt as DateTimeOffset?
        });

        return Ok(result);
    }

    private async Task<bool> HasAccessAsync(Guid studentId, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return true;
        return await db.ParentStudents
            .AnyAsync(ps => ps.ParentId == CurrentUserId && ps.StudentId == studentId, ct);
    }
}

public record LinkParentRequest(Guid ParentId, Guid StudentId);

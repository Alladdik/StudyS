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
public class RecordingsController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Teacher saves a recording for a lesson
    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Save([FromBody] SaveRecordingRequest req, CancellationToken ct)
    {
        var recording = new LessonRecording
        {
            LessonId      = req.LessonId,
            TeacherId     = CurrentUserId,
            FileUrl       = req.FileUrl,
            Title         = req.Title,
            FileSizeBytes = req.FileSizeBytes
        };
        db.LessonRecordings.Add(recording);
        await db.SaveChangesAsync(ct);
        return Ok(new { recording.Id, recording.RecordedAt });
    }

    // Get recordings for a lesson (students of enrolled courses can access)
    [HttpGet("{lessonId:guid}")]
    public async Task<IActionResult> GetByLesson(Guid lessonId, CancellationToken ct)
    {
        var me = CurrentUserId;

        // Verify access
        var lesson = await db.Lessons
            .Include(l => l.Module).ThenInclude(m => m.Course)
            .FirstOrDefaultAsync(l => l.Id == lessonId, ct);

        if (lesson == null) return NotFound();

        var isStudent = await db.CourseStudents
            .AnyAsync(cs => cs.CourseId == lesson.Module.CourseId && cs.StudentId == me, ct);
        var isTeacher = await db.CourseTeachers
            .AnyAsync(ct2 => ct2.CourseId == lesson.Module.CourseId && ct2.TeacherId == me, ct);

        if (!isStudent && !isTeacher && !User.IsInRole("Admin"))
            return Forbid();

        var recordings = await db.LessonRecordings
            .Include(r => r.Teacher)
            .Where(r => r.LessonId == lessonId)
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.FileUrl,
                r.FileSizeBytes,
                r.RecordedAt,
                TeacherName = r.Teacher.FirstName + " " + r.Teacher.LastName
            })
            .ToListAsync(ct);

        return Ok(recordings);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var rec = await db.LessonRecordings.FindAsync([id], ct);
        if (rec == null) return NotFound();
        if (rec.TeacherId != CurrentUserId && !User.IsInRole("Admin")) return Forbid();

        db.LessonRecordings.Remove(rec);
        await db.SaveChangesAsync(ct);
        return Ok();
    }
}

public record SaveRecordingRequest(Guid LessonId, string FileUrl, string? Title, long FileSizeBytes);

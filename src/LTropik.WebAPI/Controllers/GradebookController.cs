using System.Security.Claims;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Teacher,Admin,Manager")]
public class GradebookController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Returns a 2D gradebook: students × lessons with grades and attendance.
    /// </summary>
    [HttpGet("{courseId:guid}")]
    public async Task<IActionResult> Get(Guid courseId, CancellationToken ct)
    {
        // Security: teachers only see their own courses
        if (User.IsInRole("Teacher"))
        {
            var isTeacher = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == courseId && ct2.TeacherId == CurrentUserId, ct);
            if (!isTeacher) return Forbid();
        }

        var course = await db.Courses
            .Include(c => c.Modules).ThenInclude(m => m.Lessons)
            .FirstOrDefaultAsync(c => c.Id == courseId, ct);

        if (course == null) return NotFound();

        var lessons = course.Modules
            .OrderBy(m => m.SortOrder)
            .SelectMany(m => m.Lessons.OrderBy(l => l.SortOrder)
                .Select(l => new { l.Id, l.Title, ModuleTitle = m.Title }))
            .ToList();

        var students = await db.CourseStudents
            .Where(cs => cs.CourseId == courseId)
            .Include(cs => cs.Student)
            .Select(cs => new { cs.Student.Id, Name = cs.Student.FirstName + " " + cs.Student.LastName, cs.Student.Email })
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

        var records = await db.AttendanceAndGrades
            .Include(a => a.Grade)
            .Where(a => a.Lesson.Module.CourseId == courseId)
            .Select(a => new
            {
                a.StudentId,
                a.LessonId,
                Attendance = a.Attendance.ToString(),
                Grade      = a.Grade != null ? a.Grade.ValueString : null,
                a.LessonDate
            })
            .ToListAsync(ct);

        // Build student rows
        var rows = students.Select(s => new
        {
            s.Id,
            s.Name,
            s.Email,
            Cells = lessons.Select(l =>
            {
                var recs = records
                    .Where(r => r.StudentId == s.Id && r.LessonId == l.Id)
                    .OrderByDescending(r => r.LessonDate)
                    .ToList();

                return new
                {
                    LessonId   = l.Id,
                    Grade      = recs.FirstOrDefault()?.Grade,
                    Attendance = recs.FirstOrDefault()?.Attendance,
                };
            }).ToList()
        }).ToList();

        return Ok(new
        {
            CourseId    = course.Id,
            CourseTitle = course.Title,
            Lessons     = lessons,
            Students    = rows,
        });
    }

    // Grade trends for a student across all courses
    [HttpGet("trends/{studentId:guid}")]
    public async Task<IActionResult> GetTrends(Guid studentId, [FromQuery] int days = 90, CancellationToken ct = default)
    {
        // Manager role (class-level auth) + Teacher/Admin also allowed
        // Teachers can only see their own course students
        if (User.IsInRole("Teacher"))
        {
            var isRelated = await db.CourseStudents
                .AnyAsync(cs => cs.StudentId == studentId &&
                    db.CourseTeachers.Any(ct2 => ct2.CourseId == cs.CourseId && ct2.TeacherId == CurrentUserId), ct);
            if (!isRelated) return Forbid();
        }

        var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));

        var grades = await db.AttendanceAndGrades
            .Include(a => a.Grade)
            .Include(a => a.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Where(a => a.StudentId == studentId && a.GradeId != null && a.LessonDate >= from)
            .OrderBy(a => a.LessonDate)
            .Select(a => new
            {
                Date        = a.LessonDate,
                Grade       = a.Grade!.ValueString,
                IsPassing   = a.Grade.IsPassing,
                CourseTitle = a.Lesson.Module.Course.Title
            })
            .ToListAsync(ct);

        return Ok(grades);
    }
}

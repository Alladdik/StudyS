using System.Security.Claims;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ScheduleController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetSchedule([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
    {
        var userId = CurrentUserId;
        var role = User.FindFirstValue(ClaimTypes.Role);

        var start = from ?? DateTimeOffset.UtcNow.AddDays(-7);
        var end = to ?? DateTimeOffset.UtcNow.AddDays(30);

        IQueryable<Schedule> query = db.Schedules
            .Include(s => s.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Include(s => s.Teacher)
            .Where(s => s.StartsAt >= start && s.StartsAt <= end);

        if (role == "Student")
            query = query.Where(s => s.Lesson.Module.Course.Students.Any(cs => cs.StudentId == userId));
        else if (role == "Teacher")
            query = query.Where(s => s.TeacherId == userId || s.Lesson.Module.Course.Teachers.Any(t => t.TeacherId == userId));
        else if (role == "Parent")
        {
            var childIds = await db.ParentStudents
                .Where(ps => ps.ParentId == userId)
                .Select(ps => ps.StudentId)
                .ToListAsync(ct);
            query = query.Where(s => s.Lesson.Module.Course.Students.Any(cs => childIds.Contains(cs.StudentId)));
        }

        var entries = await query
            .OrderBy(s => s.StartsAt)
            .Select(s => new ScheduleEntryDto(
                s.Id, s.LessonId, s.Lesson.Title,
                s.Lesson.Module.Course.Title,
                s.TeacherId, s.Teacher.FirstName + " " + s.Teacher.LastName,
                s.StartsAt, s.DurationMinutes, s.Notes,
                s.Lesson.Module.CourseId))
            .ToListAsync(ct);

        return Ok(entries);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Create(CreateScheduleRequest req, CancellationToken ct)
    {
        var currentUserId = CurrentUserId;
        Guid teacherId;

        var lesson = await db.Lessons
            .Include(l => l.Module)
            .FirstOrDefaultAsync(l => l.Id == req.LessonId, ct);
        if (lesson == null) return NotFound();

        if (User.IsInRole("Admin"))
        {
            if (req.TeacherId.HasValue)
            {
                teacherId = req.TeacherId.Value;
                var teacherExists = await db.Users.AnyAsync(u => u.Id == teacherId && u.Role == Domain.Enums.UserRole.Teacher, ct);
                if (!teacherExists) return BadRequest(new { error = "Вказаний користувач не є викладачем" });
            }
            else
            {
                // Default to the first teacher of the course
                var firstTeacher = await db.CourseTeachers
                    .Where(ct2 => ct2.CourseId == lesson.Module.CourseId)
                    .Select(ct2 => ct2.TeacherId)
                    .FirstOrDefaultAsync(ct);
                if (firstTeacher == Guid.Empty)
                {
                    return BadRequest(new { error = "До курсу не призначено жодного викладача. Будь ласка, спочатку призначте викладача або вкажіть його вручну." });
                }
                teacherId = firstTeacher;
            }
        }
        else // Teacher
        {
            teacherId = currentUserId;
            var ownsCourse = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == lesson.Module.CourseId && ct2.TeacherId == teacherId, ct);
            if (!ownsCourse) return Forbid();
        }

        var schedule = new Schedule
        {
            LessonId = req.LessonId,
            TeacherId = teacherId,
            StartsAt = req.StartsAt,
            DurationMinutes = req.DurationMinutes,
            Notes = req.Notes
        };

        db.Schedules.Add(schedule);
        await db.SaveChangesAsync(ct);
        return Ok(new { schedule.Id });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Update(Guid id, UpdateScheduleRequest req, CancellationToken ct)
    {
        var schedule = await db.Schedules
            .Include(s => s.Lesson).ThenInclude(l => l.Module)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
        if (schedule == null) return NotFound();

        var currentUserId = CurrentUserId;

        // Permission check
        if (!User.IsInRole("Admin"))
        {
            var isAssignedTeacher = schedule.TeacherId == currentUserId;
            var teachesCourse = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == schedule.Lesson.Module.CourseId && ct2.TeacherId == currentUserId, ct);
            if (!isAssignedTeacher && !teachesCourse) return Forbid();
        }

        if (req.StartsAt.HasValue) schedule.StartsAt = req.StartsAt.Value;
        if (req.DurationMinutes.HasValue) schedule.DurationMinutes = req.DurationMinutes.Value;
        if (req.Notes != null) schedule.Notes = req.Notes;

        if (req.TeacherId.HasValue)
        {
            if (User.IsInRole("Admin"))
            {
                var teacherExists = await db.Users.AnyAsync(u => u.Id == req.TeacherId.Value && u.Role == Domain.Enums.UserRole.Teacher, ct);
                if (!teacherExists) return BadRequest(new { error = "Вказаний користувач не є викладачем" });
                schedule.TeacherId = req.TeacherId.Value;
            }
            else
            {
                var newTeacherId = req.TeacherId.Value;
                var teachesCourse = await db.CourseTeachers
                    .AnyAsync(ct2 => ct2.CourseId == schedule.Lesson.Module.CourseId && ct2.TeacherId == newTeacherId, ct);
                if (!teachesCourse) return BadRequest(new { error = "Викладач не викладає цей курс" });
                schedule.TeacherId = newTeacherId;
            }
        }

        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var schedule = await db.Schedules
            .Include(s => s.Lesson).ThenInclude(l => l.Module)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
        if (schedule == null) return NotFound();

        var currentUserId = CurrentUserId;

        // Permission check
        if (!User.IsInRole("Admin"))
        {
            var isAssignedTeacher = schedule.TeacherId == currentUserId;
            var teachesCourse = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == schedule.Lesson.Module.CourseId && ct2.TeacherId == currentUserId, ct);
            if (!isAssignedTeacher && !teachesCourse) return Forbid();
        }

        db.Schedules.Remove(schedule);
        await db.SaveChangesAsync(ct);
        return Ok();
    }
}

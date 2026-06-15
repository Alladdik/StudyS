using System.Security.Claims;
using LTropik.Application.Authorization;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.Domain.Enums;
using LTropik.WebAPI.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController(
    IApplicationDbContext db,
    INotificationService notificationService,
    ITelegramNotificationService telegramService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin,Manager")]
    [Audit("AttendanceSet")]
    public async Task<IActionResult> Set(SetAttendanceRequest req, CancellationToken ct)
    {
        // Teachers may only set grades/attendance for lessons in their own courses
        // (admins/managers are unrestricted).
        if (User.IsInRole("Teacher") && !await db.TeacherOwnsLessonAsync(req.LessonId, CurrentUserId, ct))
            return Forbid();

        // Load all existing records for this lesson/date in one query instead of
        // hitting the DB once per student.
        var studentIds = req.Records.Select(r => r.StudentId).ToList();
        var existingByStudent = (await db.AttendanceAndGrades
                .Where(a => a.LessonId == req.LessonId &&
                            a.LessonDate == req.LessonDate &&
                            studentIds.Contains(a.StudentId))
                .ToListAsync(ct))
            .GroupBy(a => a.StudentId)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var record in req.Records)
        {
            if (existingByStudent.TryGetValue(record.StudentId, out var existing))
            {
                existing.Attendance = record.Attendance;
                existing.GradeId = record.GradeId;
            }
            else
            {
                db.AttendanceAndGrades.Add(new AttendanceAndGrade
                {
                    StudentId = record.StudentId,
                    LessonId = req.LessonId,
                    Attendance = record.Attendance,
                    GradeId = record.GradeId,
                    LessonDate = req.LessonDate
                });
            }
        }

        await db.SaveChangesAsync(ct);

        // Fetch lesson/course name once for notifications
        var lesson = await db.Lessons
            .Include(l => l.Module).ThenInclude(m => m.Course)
            .FirstOrDefaultAsync(l => l.Id == req.LessonId, ct);
        var courseName  = lesson?.Module?.Course?.Title ?? "";
        var lessonDate  = req.LessonDate.ToString("dd.MM.yyyy");

        foreach (var record in req.Records)
        {
            // In-app + Telegram when grade is set
            if (record.GradeId.HasValue)
            {
                var grade = await db.GradeScaleValues.FindAsync([record.GradeId.Value], ct);
                if (grade != null)
                {
                    await notificationService.SendAsync(
                        record.StudentId, "NewGrade",
                        "Нова оцінка", $"Оцінка: {grade.ValueString}",
                        "/student/diary", ct);

                    var services = HttpContext.RequestServices;
                    var sid = record.StudentId;
                    var gv  = grade.ValueString;
                    var cn  = courseName;
                    _ = Task.Run(async () =>
                    {
                        using var scope = services.CreateScope();
                        var tg = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
                        await tg.NotifyGradeChangedAsync(sid, gv, cn);
                        await tg.NotifyParentsAboutGradeAsync(sid, gv, cn);
                    });
                }
            }

            // Telegram when student is absent (without reason)
            if (record.Attendance == AttendanceStatus.AbsentWithoutReason)
            {
                var services = HttpContext.RequestServices;
                var sid  = record.StudentId;
                var cn   = courseName;
                var ld   = lessonDate;
                _ = Task.Run(async () =>
                {
                    using var scope = services.CreateScope();
                    var tg = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
                    await tg.NotifyAbsenceAsync(sid, cn, ld);
                });
            }
        }

        return Ok();
    }

    [HttpPost("bulk-present")]
    [Authorize(Roles = "Teacher,Admin,Manager")]
    public async Task<IActionResult> BulkMarkPresent(BulkMarkPresentRequest req, CancellationToken ct)
    {
        var lesson = await db.Lessons
            .Include(l => l.Module).ThenInclude(m => m.Course).ThenInclude(c => c.Students)
            .FirstOrDefaultAsync(l => l.Id == req.LessonId, ct);

        if (lesson == null) return NotFound();

        // Teachers may only mark attendance for their own courses (admins/managers unrestricted).
        if (User.IsInRole("Teacher") &&
            !await db.TeacherOwnsCourseAsync(lesson.Module.CourseId, CurrentUserId, ct))
            return Forbid();

        foreach (var enrollment in lesson.Module.Course.Students)
        {
            var existing = await db.AttendanceAndGrades
                .FirstOrDefaultAsync(a =>
                    a.StudentId == enrollment.StudentId &&
                    a.LessonId == req.LessonId &&
                    a.LessonDate == req.LessonDate, ct);

            if (existing != null)
                existing.Attendance = AttendanceStatus.Present;
            else
                db.AttendanceAndGrades.Add(new AttendanceAndGrade
                {
                    StudentId = enrollment.StudentId,
                    LessonId = req.LessonId,
                    Attendance = AttendanceStatus.Present,
                    LessonDate = req.LessonDate
                });
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { marked = lesson.Module.Course.Students.Count });
    }

    [HttpGet("journal")]
    public async Task<IActionResult> GetJournal([FromQuery] Guid courseId, CancellationToken ct)
    {
        var userId = CurrentUserId;

        IQueryable<AttendanceAndGrade> query = db.AttendanceAndGrades
            .Include(a => a.Student)
            .Include(a => a.Grade)
            .Where(a => a.Lesson.Module.CourseId == courseId);

        if (User.IsInRole("Student"))
        {
            // Students see only their own records
            query = query.Where(a => a.StudentId == userId);
        }
        else if (User.IsInRole("Parent"))
        {
            // Parents see only their linked children's records
            var childIds = db.ParentStudents
                .Where(ps => ps.ParentId == userId)
                .Select(ps => ps.StudentId);
            query = query.Where(a => childIds.Contains(a.StudentId));
        }
        // Teacher/Admin — see all students in the course (no filter)

        var records = await query
            .OrderBy(a => a.LessonDate)
            .Select(a => new JournalEntryDto(
                a.StudentId,
                a.Student.FirstName + " " + a.Student.LastName,
                a.Attendance,
                a.Grade != null ? a.Grade.ValueString : null,
                a.LessonDate))
            .ToListAsync(ct);

        return Ok(records);
    }
}

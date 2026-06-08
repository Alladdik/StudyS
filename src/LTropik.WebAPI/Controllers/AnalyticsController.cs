using LTropik.Application.Interfaces;
using LTropik.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class AnalyticsController(IApplicationDbContext db) : ControllerBase
{
    // ── Summary ────────────────────────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct = default)
    {
        var totalStudents = await db.Users.CountAsync(u => u.Role == UserRole.Student && u.IsActive, ct);
        var totalTeachers = await db.Users.CountAsync(u => u.Role == UserRole.Teacher && u.IsActive, ct);
        var totalCourses  = await db.Courses.CountAsync(ct);
        var pendingHw     = await db.HomeworkSubmissions.CountAsync(s => s.Status == HomeworkStatus.OnReview, ct);
        var totalRevenue  = await db.PaymentTransactions.Where(t => t.Status == "Success").SumAsync(t => (decimal?)t.Amount, ct) ?? 0;

        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1);
        var thisMonthRevenue = await db.PaymentTransactions
            .Where(t => t.Status == "Success" && t.CreatedAt >= monthStart)
            .SumAsync(t => (decimal?)t.Amount, ct) ?? 0;

        return Ok(new { totalStudents, totalTeachers, totalCourses, totalRevenue, thisMonthRevenue, pendingHw });
    }

    // ── Revenue ────────────────────────────────────────────────────────────────
    [HttpGet("revenue")]
    public async Task<IActionResult> GetRevenue([FromQuery] int months = 6, CancellationToken ct = default)
    {
        var from = DateTime.UtcNow.AddMonths(-months);

        var raw = await db.PaymentTransactions
            .Where(t => t.Status == "Success" && t.CreatedAt >= from)
            .Select(t => new { t.Amount, t.CreatedAt })
            .ToListAsync(ct);

        // Group in memory — avoids DateTimeOffset translation issues
        var grouped = raw
            .GroupBy(t => new { t.CreatedAt.Year, t.CreatedAt.Month })
            .Select(g => new
            {
                month   = $"{g.Key.Year}-{g.Key.Month:D2}",
                revenue = g.Sum(t => t.Amount),
                count   = g.Count(),
            })
            .OrderBy(x => x.month)
            .ToList();

        return Ok(grouped);
    }

    // ── Activity ───────────────────────────────────────────────────────────────
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] int days = 30, CancellationToken ct = default)
    {
        var from = DateTime.UtcNow.AddDays(-days);

        // Pull raw timestamps — grouping in memory avoids EF DateTimeOffset.Date translation
        var hwDates = await db.HomeworkSubmissions
            .Where(s => s.UpdatedAt >= from)
            .Select(s => s.UpdatedAt)
            .ToListAsync(ct);

        var testDates = await db.TestAttempts
            .Where(a => a.FinishedAt != null && a.StartedAt >= from)
            .Select(a => a.StartedAt)
            .ToListAsync(ct);

        var hwByDay   = hwDates.GroupBy(d => d.Date).ToDictionary(g => g.Key, g => g.Count());
        var testByDay = testDates.GroupBy(d => d.Date).ToDictionary(g => g.Key, g => g.Count());

        var result = Enumerable.Range(0, days)
            .Select(i => DateTime.UtcNow.Date.AddDays(-days + 1 + i))
            .Select(d => new
            {
                date        = d.ToString("MM-dd"),
                submissions = hwByDay.GetValueOrDefault(d, 0),
                tests       = testByDay.GetValueOrDefault(d, 0),
            })
            .ToList();

        return Ok(result);
    }

    // ── Course stats ───────────────────────────────────────────────────────────
    [HttpGet("courses")]
    public async Task<IActionResult> GetCourseStats(CancellationToken ct = default)
    {
        var courses = await db.Courses
            .Select(c => new
            {
                id       = c.Id,
                title    = c.Title,
                students = c.Students.Count,
                lessons  = c.Modules.Sum(m => m.Lessons.Count),
            })
            .OrderByDescending(c => c.students)
            .ToListAsync(ct);

        // Revenue per course — separate query to avoid EF navigation issues
        var revenues = await db.PaymentTransactions
            .Where(t => t.Status == "Success" && t.CourseId != null)
            .GroupBy(t => t.CourseId)
            .Select(g => new { courseId = g.Key, total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        var revMap = revenues.ToDictionary(r => r.courseId, r => r.total);

        var result = courses.Select(c => new
        {
            c.id, c.title, c.students, c.lessons,
            revenue = revMap.TryGetValue(c.id, out var rev) ? rev : 0m,
        });

        return Ok(result);
    }

    // ── Churn risk ─────────────────────────────────────────────────────────────
    [HttpGet("churn-risk")]
    public async Task<IActionResult> GetChurnRisk(CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddDays(-14);

        var students = await db.Users
            .Where(u => u.Role == UserRole.Student && u.IsActive)
            .Select(u => new
            {
                u.Id,
                Name      = u.FirstName + " " + u.LastName,
                u.Email,
                HwPending = u.HomeworkSubmissions
                    .Count(s => s.Status == HomeworkStatus.OnReview || s.Status == HomeworkStatus.NotStarted),
            })
            .ToListAsync(ct);

        // Last homework submission date per student — separate query
        var lastActivity = await db.HomeworkSubmissions
            .GroupBy(s => s.StudentId)
            .Select(g => new { StudentId = g.Key, Last = g.Max(s => s.UpdatedAt) })
            .ToListAsync(ct);

        var actMap = lastActivity.ToDictionary(x => x.StudentId, x => x.Last);

        var risky = students
            .Select(u => new
            {
                last = actMap.TryGetValue(u.Id, out var la) ? (DateTimeOffset?)la : null,
                u.Id, u.Name, u.Email, u.HwPending,
            })
            .Where(u => u.last == null || u.last.Value.UtcDateTime < cutoff)
            .OrderBy(u => u.last)
            .Select(u => new
            {
                id           = u.Id,
                name         = u.Name,
                email        = u.Email,
                lastActivity = u.last?.ToString("yyyy-MM-dd") ?? "ніколи",
                hwPending    = u.HwPending,
                riskLevel    = u.last == null || u.last.Value.UtcDateTime < DateTime.UtcNow.AddDays(-30)
                               ? "high" : "medium",
            })
            .ToList();

        return Ok(risky);
    }

    // ── Teachers ───────────────────────────────────────────────────────────────
    [HttpGet("teachers")]
    public async Task<IActionResult> GetTeacherStats(CancellationToken ct = default)
    {
        // Load aggregates in separate queries to avoid N+1 in Select()
        var courseCountByTeacher = await db.CourseTeachers
            .GroupBy(ct2 => ct2.TeacherId)
            .Select(g => new { TeacherId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TeacherId, x => x.Count, ct);

        var studentCountByTeacher = await db.CourseTeachers
            .GroupBy(ct2 => ct2.TeacherId)
            .Select(g => new
            {
                TeacherId    = g.Key,
                StudentCount = db.CourseStudents
                    .Where(cs => g.Select(x => x.CourseId).Contains(cs.CourseId))
                    .Select(cs => cs.StudentId).Distinct().Count()
            })
            .ToDictionaryAsync(x => x.TeacherId, x => x.StudentCount, ct);

        var teachers = await db.Users
            .Where(u => u.Role == UserRole.Teacher && u.IsActive)
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName, u.Email })
            .ToListAsync(ct);

        var result = teachers
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Email,
                CourseCount  = courseCountByTeacher.GetValueOrDefault(u.Id, 0),
                StudentCount = studentCountByTeacher.GetValueOrDefault(u.Id, 0),
            })
            .OrderByDescending(t => t.StudentCount)
            .ToList();

        return Ok(result);
    }

    // ── Transactions list ──────────────────────────────────────────────────────
    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = db.PaymentTransactions
            .Include(t => t.Student)
            .Include(t => t.Course)
            .OrderByDescending(t => t.CreatedAt);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id, t.Amount, t.Currency, t.Status, t.ExternalTxId, t.CreatedAt,
                studentName  = t.Student.FirstName + " " + t.Student.LastName,
                studentEmail = t.Student.Email,
                courseTitle  = t.Course != null ? t.Course.Title : null
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // ── Attendance heatmap ─────────────────────────────────────────────────────
    [HttpGet("heatmap")]
    public async Task<IActionResult> GetAttendanceHeatmap(
        [FromQuery] Guid? studentId,
        [FromQuery] int days = 365,
        CancellationToken ct = default)
    {
        if (studentId is null || studentId == Guid.Empty)
            return BadRequest(new { error = "studentId required" });

        var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));

        var data = await db.AttendanceAndGrades
            .Where(a => a.StudentId == studentId && a.LessonDate >= from)
            .GroupBy(a => a.LessonDate)
            .Select(g => new
            {
                date    = g.Key,
                present = g.Count(a => a.Attendance == AttendanceStatus.Present || a.Attendance == AttendanceStatus.Late),
                absent  = g.Count(a => a.Attendance == AttendanceStatus.AbsentWithoutReason || a.Attendance == AttendanceStatus.AbsentWithReason),
            })
            .OrderBy(g => g.date)
            .ToListAsync(ct);

        return Ok(data);
    }
}

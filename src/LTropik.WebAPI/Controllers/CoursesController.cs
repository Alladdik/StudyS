using System.Security.Claims;
using System.Text.Json;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.WebAPI.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CoursesController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        IQueryable<Course> query = db.Courses.Include(c => c.GradeScale);

        if (role == "Student")
            query = query.Where(c => c.Status == "Published" && c.Students.Any(s => s.StudentId == userId));
        else if (role == "Teacher")
            query = query.Where(c => c.Teachers.Any(t => t.TeacherId == userId));

        var courses = await query.Select(c => new CourseDto(
            c.Id, c.Title, c.Description,
            c.GradeScaleId, c.GradeScale != null ? c.GradeScale.Name : null,
            c.Status,
            c.CreatedAt)).ToListAsync(ct);

        return Ok(courses);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var c = await db.Courses
            .Include(x => x.GradeScale)
            .Include(x => x.Modules).ThenInclude(m => m.Lessons)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (c == null) return NotFound();

        return Ok(new
        {
            c.Id, c.Title, c.Description, c.GradeScaleId, c.Status, c.CreatedAt,
            GradeScaleName = c.GradeScale?.Name,
            Modules = c.Modules
                .OrderBy(m => m.SortOrder)
                .Select(m => new
                {
                    m.Id, m.Title, m.SortOrder,
                    Lessons = m.Lessons
                        .OrderBy(l => l.SortOrder)
                        .Select(l => new { l.Id, l.Title, l.SortOrder })
                })
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    [Audit("CourseCreated")]
    public async Task<IActionResult> Create(CreateCourseRequest req, CancellationToken ct)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var course = new Course
        {
            Title = req.Title,
            Description = req.Description,
            GradeScaleId = req.GradeScaleId,
            Status = role == "Admin" ? "Published" : "Draft"
        };
        db.Courses.Add(course);

        if (role == "Teacher")
            db.CourseTeachers.Add(new CourseTeacher { CourseId = course.Id, TeacherId = userId });

        await db.SaveChangesAsync(ct);

        var dto = new CourseDto(
            course.Id, course.Title, course.Description,
            course.GradeScaleId, null, course.Status, course.CreatedAt);

        return CreatedAtAction(nameof(GetById), new { id = course.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    [Audit("CourseUpdated")]
    public async Task<IActionResult> Update(Guid id, UpdateCourseRequest req, CancellationToken ct)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var course = await db.Courses.FindAsync([id], ct);
        if (course == null) return NotFound();

        if (role == "Teacher" && !await db.CourseTeachers.AnyAsync(ct2 => ct2.CourseId == id && ct2.TeacherId == userId, ct))
            return Forbid();

        if (req.Title != null) course.Title = req.Title;
        if (req.Description != null) course.Description = req.Description;
        if (req.GradeScaleId.HasValue) course.GradeScaleId = req.GradeScaleId;

        await db.SaveChangesAsync(ct);
        return Ok(new CourseDto(
            course.Id, course.Title, course.Description,
            course.GradeScaleId, null, course.Status, course.CreatedAt));
    }

    [HttpPost("{courseId:guid}/modules")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> AddModule(Guid courseId, CreateModuleRequest req, CancellationToken ct)
    {
        var role   = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Teachers can only modify their own courses
        if (role == "Teacher")
        {
            var owns = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == courseId && ct2.TeacherId == userId, ct);
            if (!owns) return Forbid();
        }

        var module = new Module { CourseId = courseId, Title = req.Title, SortOrder = req.SortOrder };
        db.Modules.Add(module);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = courseId }, new { module.Id, module.CourseId, module.Title, module.SortOrder });
    }

    [HttpPost("{courseId:guid}/modules/{moduleId:guid}/lessons")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> AddLesson(
        Guid courseId, Guid moduleId, CreateLessonRequest req, CancellationToken ct)
    {
        var role   = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (role == "Teacher")
        {
            var owns = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == courseId && ct2.TeacherId == userId, ct);
            if (!owns) return Forbid();
        }

        var module = await db.Modules.FindAsync([moduleId], ct);
        if (module == null || module.CourseId != courseId) return NotFound();

        var blocksJson = JsonSerializer.Serialize(req.ContentBlocks);
        var lesson = new Lesson
        {
            ModuleId = moduleId,
            Title = req.Title,
            SortOrder = req.SortOrder,
            ContentBlocks = JsonDocument.Parse(blocksJson)
        };
        db.Lessons.Add(lesson);
        await db.SaveChangesAsync(ct);
        return Ok(new { lesson.Id, lesson.ModuleId, lesson.Title, lesson.SortOrder });
    }

    [HttpPost("{courseId:guid}/enroll/{studentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> EnrollStudent(Guid courseId, Guid studentId, CancellationToken ct)
    {
        if (await db.CourseStudents.AnyAsync(cs => cs.CourseId == courseId && cs.StudentId == studentId, ct))
            return Conflict(new { error = "Студент вже записаний" });

        db.CourseStudents.Add(new CourseStudent { CourseId = courseId, StudentId = studentId });
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{courseId:guid}/enroll/{studentId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Unenroll(Guid courseId, Guid studentId, CancellationToken ct)
    {
        var link = await db.CourseStudents.FirstOrDefaultAsync(cs => cs.CourseId == courseId && cs.StudentId == studentId, ct);
        if (link == null) return NotFound();
        db.CourseStudents.Remove(link);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── Teacher assignment (was missing — teachers had empty course lists) ──
    [HttpPost("{courseId:guid}/teachers/{teacherId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AssignTeacher(Guid courseId, Guid teacherId, CancellationToken ct)
    {
        var teacher = await db.Users.FindAsync([teacherId], ct);
        if (teacher == null || teacher.Role != Domain.Enums.UserRole.Teacher)
            return BadRequest(new { error = "Користувач не є викладачем" });

        if (await db.CourseTeachers.AnyAsync(ct2 => ct2.CourseId == courseId && ct2.TeacherId == teacherId, ct))
            return Conflict(new { error = "Викладач вже призначений" });

        db.CourseTeachers.Add(new CourseTeacher { CourseId = courseId, TeacherId = teacherId });
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{courseId:guid}/teachers/{teacherId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveTeacher(Guid courseId, Guid teacherId, CancellationToken ct)
    {
        var link = await db.CourseTeachers.FirstOrDefaultAsync(ct2 => ct2.CourseId == courseId && ct2.TeacherId == teacherId, ct);
        if (link == null) return NotFound();
        db.CourseTeachers.Remove(link);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── Members: teachers + students of a course ───────────────────────────
    [HttpGet("{courseId:guid}/members")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GetMembers(Guid courseId, CancellationToken ct)
    {
        var teachers = await db.CourseTeachers
            .Where(ct2 => ct2.CourseId == courseId)
            .Select(ct2 => new
            {
                ct2.TeacherId,
                Name = ct2.Teacher.FirstName + " " + ct2.Teacher.LastName,
                ct2.Teacher.Email,
            })
            .ToListAsync(ct);

        var students = await db.CourseStudents
            .Where(cs => cs.CourseId == courseId)
            .Select(cs => new
            {
                cs.StudentId,
                Name = cs.Student.FirstName + " " + cs.Student.LastName,
                cs.Student.Email,
            })
            .ToListAsync(ct);

        return Ok(new { teachers, students });
    }

    [HttpPost("{id:guid}/submit-review")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> SubmitReview(Guid id, CancellationToken ct)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var course = await db.Courses.FindAsync([id], ct);
        if (course == null) return NotFound();

        if (role == "Teacher" && !await db.CourseTeachers.AnyAsync(ct2 => ct2.CourseId == id && ct2.TeacherId == userId, ct))
            return Forbid();

        course.Status = "OnReview";
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        var course = await db.Courses.FindAsync([id], ct);
        if (course == null) return NotFound();

        course.Status = "Published";
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken ct)
    {
        var course = await db.Courses.FindAsync([id], ct);
        if (course == null) return NotFound();

        course.Status = "Draft";
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── Public (no auth) ─────────────────────────────────────────────────────
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublic(CancellationToken ct)
    {
        var courses = await db.Courses
            .Where(c => c.Status == "Published")
            .Select(c => new
            {
                c.Id, c.Title, c.Description, c.CreatedAt,
                LessonCount  = c.Modules.Sum(m => m.Lessons.Count),
                StudentCount = c.Students.Count,
                Rating       = c.Reviews.Any()
                    ? Math.Round(c.Reviews.Average(r => (double)r.Rating), 1) : (double?)null,
                ReviewCount  = c.Reviews.Count()
            })
            .OrderByDescending(c => c.StudentCount)
            .ToListAsync(ct);

        return Ok(courses);
    }

    [HttpGet("{id:guid}/public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicById(Guid id, CancellationToken ct)
    {
        var c = await db.Courses
            .Include(x => x.Modules).ThenInclude(m => m.Lessons)
            .FirstOrDefaultAsync(x => x.Id == id && x.Status == "Published", ct);

        if (c == null) return NotFound();

        var reviews = await db.CourseReviews
            .Include(r => r.Student)
            .Where(r => r.CourseId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Take(10)
            .Select(r => new
            {
                r.Rating, r.Comment, r.CreatedAt,
                StudentName = r.Student.FirstName + " " + r.Student.LastName
            })
            .ToListAsync(ct);

        return Ok(new
        {
            c.Id, c.Title, c.Description, c.CreatedAt,
            Modules = c.Modules.OrderBy(m => m.SortOrder).Select(m => new
            {
                m.Title, m.SortOrder,
                LessonCount = m.Lessons.Count,
                Lessons = m.Lessons.OrderBy(l => l.SortOrder).Select(l => new { l.Title, l.SortOrder })
            }),
            Rating      = reviews.Any() ? Math.Round(reviews.Average(r => (double)r.Rating), 1) : (double?)null,
            ReviewCount = reviews.Count,
            Reviews     = reviews
        });
    }

    // ── Reviews ───────────────────────────────────────────────────────────────
    [HttpPost("{courseId:guid}/reviews")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> AddReview(Guid courseId, [FromBody] AddReviewRequest req, CancellationToken ct)
    {
        var studentId = Guid.Parse(User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier)!);

        if (!await db.CourseStudents.AnyAsync(cs => cs.CourseId == courseId && cs.StudentId == studentId, ct))
            return Forbid();

        var existing = await db.CourseReviews.FirstOrDefaultAsync(
            r => r.CourseId == courseId && r.StudentId == studentId, ct);

        if (existing != null)
        {
            existing.Rating  = req.Rating;
            existing.Comment = req.Comment;
        }
        else
        {
            db.CourseReviews.Add(new CourseReview
            {
                CourseId  = courseId,
                StudentId = studentId,
                Rating    = req.Rating,
                Comment   = req.Comment
            });
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { message = "Відгук збережено" });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("CourseDeleted")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var course = await db.Courses.FindAsync([id], ct);
        if (course == null) return NotFound();

        db.Courses.Remove(course);
        await db.SaveChangesAsync(ct);
        return Ok();
    }
}

public record AddReviewRequest(int Rating, string? Comment);

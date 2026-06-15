using System.Security.Claims;
using LTropik.Application.Authorization;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LessonsController(IApplicationDbContext db, IBillingService billing) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var lesson = await db.Lessons
            .Include(l => l.Module)
            .Include(l => l.Homeworks)
            .Include(l => l.Tests)
            .FirstOrDefaultAsync(l => l.Id == id, ct);

        if (lesson == null) return NotFound();

        var courseId = lesson.Module.CourseId;

        // Access control. Without this, any authenticated user could read any lesson
        // by id, bypassing both enrollment and the payment gate that
        // AccessControlMiddleware only applies to the lesson *list*.
        if (User.IsInRole("Student"))
        {
            var enrolled = await db.CourseStudents
                .AnyAsync(cs => cs.CourseId == courseId && cs.StudentId == CurrentUserId, ct);
            if (!enrolled) return Forbid();

            if (!await billing.HasActiveAccessAsync(CurrentUserId, courseId, ct))
                return StatusCode(403, new { error = "Доступ заблоковано. Необхідно подовжити оплату." });
        }
        else if (User.IsInRole("Teacher"))
        {
            if (!await db.TeacherOwnsCourseAsync(courseId, CurrentUserId, ct)) return Forbid();
        }
        // Admin/Manager: unrestricted.

        return Ok(new
        {
            lesson.Id,
            lesson.ModuleId,
            lesson.Title,
            lesson.SortOrder,
            ContentBlocks = System.Text.Json.JsonSerializer.Deserialize<object[]>(
                lesson.ContentBlocks.RootElement.GetRawText()) ?? [],
            Homeworks = lesson.Homeworks.Select(h => new { h.Id, h.Instruction }),
            Tests = lesson.Tests.Select(t => new { t.Id, t.Title })
        });
    }
}

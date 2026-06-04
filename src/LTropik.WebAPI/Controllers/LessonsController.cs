using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LessonsController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var lesson = await db.Lessons
            .Include(l => l.Homeworks)
            .Include(l => l.Tests)
            .FirstOrDefaultAsync(l => l.Id == id, ct);

        if (lesson == null) return NotFound();

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

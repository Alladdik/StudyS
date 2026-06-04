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
public class NotesController(IApplicationDbContext db) : ControllerBase
{
    private Guid Me => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("{lessonId:guid}")]
    public async Task<IActionResult> Get(Guid lessonId, CancellationToken ct)
    {
        var note = await db.LessonNotes
            .FirstOrDefaultAsync(n => n.StudentId == Me && n.LessonId == lessonId, ct);
        return Ok(new { content = note?.Content ?? "", updatedAt = note?.UpdatedAt });
    }

    [HttpPut("{lessonId:guid}")]
    public async Task<IActionResult> Save(Guid lessonId, [FromBody] SaveNoteRequest req, CancellationToken ct)
    {
        var note = await db.LessonNotes
            .FirstOrDefaultAsync(n => n.StudentId == Me && n.LessonId == lessonId, ct);

        if (note is null)
        {
            db.LessonNotes.Add(new LessonNote
            {
                StudentId = Me,
                LessonId  = lessonId,
                Content   = req.Content,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            note.Content   = req.Content;
            note.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{lessonId:guid}")]
    public async Task<IActionResult> Delete(Guid lessonId, CancellationToken ct)
    {
        var note = await db.LessonNotes
            .FirstOrDefaultAsync(n => n.StudentId == Me && n.LessonId == lessonId, ct);
        if (note is not null) { db.LessonNotes.Remove(note); await db.SaveChangesAsync(ct); }
        return Ok();
    }
}

public record SaveNoteRequest(string Content);

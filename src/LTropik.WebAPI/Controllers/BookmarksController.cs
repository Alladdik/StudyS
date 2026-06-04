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
public class BookmarksController(IApplicationDbContext db) : ControllerBase
{
    private Guid Me => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Bookmarks
            .Where(b => b.UserId == Me)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new { b.Id, b.Type, b.RefId, b.Title, b.CreatedAt })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddBookmarkRequest req, CancellationToken ct)
    {
        var existing = await db.Bookmarks
            .FirstOrDefaultAsync(b => b.UserId == Me && b.Type == req.Type && b.RefId == req.RefId, ct);
        if (existing is not null) return Ok(new { existing.Id, toggled = false });

        var bm = new Bookmark { UserId = Me, Type = req.Type, RefId = req.RefId, Title = req.Title };
        db.Bookmarks.Add(bm);
        await db.SaveChangesAsync(ct);
        return Ok(new { bm.Id, toggled = true });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
    {
        var bm = await db.Bookmarks.FirstOrDefaultAsync(b => b.Id == id && b.UserId == Me, ct);
        if (bm is null) return NotFound();
        db.Bookmarks.Remove(bm);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("ref/{type}/{refId:guid}")]
    public async Task<IActionResult> RemoveByRef(string type, Guid refId, CancellationToken ct)
    {
        var bm = await db.Bookmarks.FirstOrDefaultAsync(b => b.UserId == Me && b.Type == type && b.RefId == refId, ct);
        if (bm is not null) { db.Bookmarks.Remove(bm); await db.SaveChangesAsync(ct); }
        return Ok();
    }
}

public record AddBookmarkRequest(string Type, Guid RefId, string? Title);

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
public class CommentsController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("lesson/{lessonId:guid}")]
    public async Task<IActionResult> GetByLesson(Guid lessonId, CancellationToken ct)
    {
        var all = await db.LessonComments
            .Include(c => c.Author)
            .Where(c => c.LessonId == lessonId && !c.IsDeleted)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);

        var roots = all
            .Where(c => c.ParentCommentId == null)
            .Select(c => MapComment(c, all))
            .ToList();

        return Ok(roots);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateCommentRequest req, CancellationToken ct)
    {
        var comment = new LessonComment
        {
            LessonId = req.LessonId,
            AuthorId = CurrentUserId,
            Body = req.Body,
            ParentCommentId = req.ParentCommentId
        };
        db.LessonComments.Add(comment);
        await db.SaveChangesAsync(ct);

        var author = await db.Users.FindAsync([CurrentUserId], ct);
        return Ok(new LessonCommentDto(
            comment.Id, comment.AuthorId,
            author != null ? $"{author.FirstName} {author.LastName}" : "?",
            comment.Body, comment.ParentCommentId, comment.CreatedAt, []));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var comment = await db.LessonComments.FindAsync([id], ct);
        if (comment == null) return NotFound();

        var role = User.FindFirstValue(ClaimTypes.Role);
        if (comment.AuthorId != CurrentUserId && role is not "Admin" and not "Teacher")
            return Forbid();

        comment.IsDeleted = true;
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    private static LessonCommentDto MapComment(LessonComment c, List<LessonComment> all) =>
        new(c.Id, c.AuthorId, $"{c.Author.FirstName} {c.Author.LastName}",
            c.Body, c.ParentCommentId, c.CreatedAt,
            all.Where(r => r.ParentCommentId == c.Id && !r.IsDeleted)
               .Select(r => MapComment(r, all)).ToList());
}

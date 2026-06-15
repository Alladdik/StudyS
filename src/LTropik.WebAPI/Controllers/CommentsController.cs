using System.Security.Claims;
using LTropik.Application.Authorization;
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

    // Comments belong to a lesson, so access follows course membership: an enrolled
    // student or a teacher of the course (admins/managers unrestricted).
    private async Task<bool> CanAccessLesson(Guid lessonId, CancellationToken ct)
    {
        if (User.IsInRole("Admin") || User.IsInRole("Manager")) return true;

        var courseId = await db.Lessons
            .Where(l => l.Id == lessonId)
            .Select(l => l.Module.CourseId)
            .FirstOrDefaultAsync(ct);
        if (courseId == Guid.Empty) return false;

        return await db.CourseStudents.AnyAsync(cs => cs.CourseId == courseId && cs.StudentId == CurrentUserId, ct)
            || await db.CourseTeachers.AnyAsync(t => t.CourseId == courseId && t.TeacherId == CurrentUserId, ct);
    }

    [HttpGet("lesson/{lessonId:guid}")]
    public async Task<IActionResult> GetByLesson(Guid lessonId, CancellationToken ct)
    {
        if (!await CanAccessLesson(lessonId, ct)) return Forbid();

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
        if (!await CanAccessLesson(req.LessonId, ct)) return Forbid();

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

        // Author can delete their own; admins/managers anywhere; a teacher only on a
        // lesson in a course they actually teach (previously any teacher could delete
        // any comment on any course).
        var role = User.FindFirstValue(ClaimTypes.Role);
        var isModerator = role is "Admin" or "Manager"
            || (role == "Teacher" && await db.TeacherOwnsLessonAsync(comment.LessonId, CurrentUserId, ct));
        if (comment.AuthorId != CurrentUserId && !isModerator)
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

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
public class ReactionsController(IApplicationDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static readonly HashSet<string> AllowedEmojis = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉"];

    // Toggle reaction on a direct message
    [HttpPost("dm/{messageId:guid}")]
    public async Task<IActionResult> ToggleDm(Guid messageId, [FromBody] ReactionRequest req, CancellationToken ct)
    {
        if (!AllowedEmojis.Contains(req.Emoji))
            return BadRequest(new { error = "Невірний емодзі" });

        var existing = await db.MessageReactions
            .FirstOrDefaultAsync(r => r.DirectMessageId == messageId
                && r.UserId == CurrentUserId && r.Emoji == req.Emoji, ct);

        if (existing != null)
            db.MessageReactions.Remove(existing);
        else
            db.MessageReactions.Add(new MessageReaction
            {
                DirectMessageId = messageId,
                UserId  = CurrentUserId,
                Emoji   = req.Emoji
            });

        await db.SaveChangesAsync(ct);
        return Ok(await GetDmReactions(messageId, ct));
    }

    // Get all reactions for a DM
    [HttpGet("dm/{messageId:guid}")]
    public async Task<IActionResult> GetDm(Guid messageId, CancellationToken ct) =>
        Ok(await GetDmReactions(messageId, ct));

    private async Task<object> GetDmReactions(Guid messageId, CancellationToken ct)
    {
        var reactions = await db.MessageReactions
            .Where(r => r.DirectMessageId == messageId)
            .GroupBy(r => r.Emoji)
            .Select(g => new { emoji = g.Key, count = g.Count(), mine = g.Any(r => r.UserId == CurrentUserId) })
            .ToListAsync(ct);
        return reactions;
    }
}

public record ReactionRequest(string Emoji);

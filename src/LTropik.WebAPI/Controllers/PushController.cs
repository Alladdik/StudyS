using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/push")]
[Authorize]
public class PushController(IApplicationDbContext db) : ControllerBase
{
    private Guid Me => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubRequest req, CancellationToken ct)
    {
        // Remove old subscription for same endpoint if exists
        var old = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == Me && s.Endpoint == req.Endpoint, ct);
        if (old is not null) db.PushSubscriptions.Remove(old);

        db.PushSubscriptions.Add(new PushSubscription
        {
            UserId   = Me,
            Endpoint = req.Endpoint,
            P256dh   = req.P256dh,
            Auth     = req.Auth,
        });

        await db.SaveChangesAsync(ct);
        return Ok(new { subscribed = true });
    }

    [HttpDelete("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubRequest req, CancellationToken ct)
    {
        var sub = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == Me && s.Endpoint == req.Endpoint, ct);
        if (sub is not null) { db.PushSubscriptions.Remove(sub); await db.SaveChangesAsync(ct); }
        return Ok();
    }
}

public record PushSubRequest(string Endpoint, string P256dh, string Auth);
public record UnsubRequest(string Endpoint);

using System.Security.Claims;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController(IApplicationDbContext db, INotificationService notificationService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var notifications = await db.AppNotifications
            .Where(n => n.UserId == CurrentUserId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new AppNotificationDto(n.Id, n.Type, n.Title, n.Body, n.IsRead, n.ActionUrl, n.CreatedAt))
            .ToListAsync(ct);

        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken ct)
    {
        var count = await db.AppNotifications
            .CountAsync(n => n.UserId == CurrentUserId && !n.IsRead, ct);
        return Ok(new { count });
    }

    [HttpPost("mark-read")]
    public async Task<IActionResult> MarkRead(MarkReadRequest req, CancellationToken ct)
    {
        var notifications = await db.AppNotifications
            .Where(n => n.UserId == CurrentUserId && req.Ids.Contains(n.Id))
            .ToListAsync(ct);

        foreach (var n in notifications)
            n.IsRead = true;

        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("mark-all-read")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var notifications = await db.AppNotifications
            .Where(n => n.UserId == CurrentUserId && !n.IsRead)
            .ToListAsync(ct);

        foreach (var n in notifications)
            n.IsRead = true;

        await db.SaveChangesAsync(ct);
        return Ok(new { marked = notifications.Count });
    }

    /// <summary>Sends a test notification to yourself — verifies SignalR bell works</summary>
    [HttpPost("test")]
    public async Task<IActionResult> SendTest(CancellationToken ct)
    {
        await notificationService.SendAsync(
            CurrentUserId,
            "TestNotification",
            "🔔 Тест сповіщень",
            "Якщо бачиш це — дзвінок працює коректно!",
            null,
            ct);

        return Ok(new { message = "Тестове сповіщення надіслано" });
    }

    // ── Admin: broadcast ──────────────────────────────────────────────────────
    [HttpPost("broadcast")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest req, CancellationToken ct)
    {
        IQueryable<Guid> query = db.Users.Select(u => u.Id);

        if (!string.IsNullOrEmpty(req.Role))
        {
            if (Enum.TryParse<LTropik.Domain.Enums.UserRole>(req.Role, true, out var role))
                query = db.Users.Where(u => u.Role == role).Select(u => u.Id);
        }

        var userIds = await query.ToListAsync(ct);
        var sent = await notificationService.SendManyAsync(userIds, "Broadcast", req.Title, req.Body, req.ActionUrl, ct);
        return Ok(new { sent });
    }

    // ── Admin: notification history ───────────────────────────────────────────
    [HttpGet("admin/history")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var total = await db.AppNotifications.CountAsync(ct);
        var items = await db.AppNotifications
            .Include(n => n.User)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                n.Id, n.Type, n.Title, n.Body, n.IsRead, n.ActionUrl, n.CreatedAt,
                userName = n.User.FirstName + " " + n.User.LastName,
                userEmail = n.User.Email
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }
}

public record BroadcastRequest(string Title, string Body, string? Role, string? ActionUrl);

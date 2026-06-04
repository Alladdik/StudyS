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
}

using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;

namespace LTropik.Infrastructure.Services;

public class NotificationService(IApplicationDbContext db, INotificationHub hub) : INotificationService
{
    public async Task SendAsync(Guid userId, string type, string title, string body, string? actionUrl = null, CancellationToken ct = default)
    {
        var notification = new AppNotification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Body = body,
            ActionUrl = actionUrl
        };

        db.AppNotifications.Add(notification);
        await db.SaveChangesAsync(ct);

        var dto = new AppNotificationDto(
            notification.Id, notification.Type, notification.Title,
            notification.Body, notification.IsRead, notification.ActionUrl, notification.CreatedAt);

        await hub.PushAsync(userId, dto);
    }

    public async Task<int> SendManyAsync(IEnumerable<Guid> userIds, string type, string title, string body, string? actionUrl = null, CancellationToken ct = default)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0) return 0;

        var notifications = ids.Select(uid => new AppNotification
        {
            UserId = uid, Type = type, Title = title, Body = body, ActionUrl = actionUrl
        }).ToList();

        // Single DB round-trip — no concurrent DbContext usage
        db.AppNotifications.AddRange(notifications);
        await db.SaveChangesAsync(ct);

        // Push to each connected client (hub is thread-safe; sequential to be safe)
        foreach (var n in notifications)
        {
            var dto = new AppNotificationDto(n.Id, n.Type, n.Title, n.Body, n.IsRead, n.ActionUrl, n.CreatedAt);
            try { await hub.PushAsync(n.UserId, dto); } catch { /* offline clients are fine */ }
        }

        return notifications.Count;
    }
}

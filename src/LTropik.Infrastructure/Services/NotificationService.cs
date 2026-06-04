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
}

namespace LTropik.Application.Interfaces;

public interface INotificationService
{
    Task SendAsync(Guid userId, string type, string title, string body, string? actionUrl = null, CancellationToken ct = default);
}

namespace LTropik.Application.Interfaces;

public interface INotificationService
{
    Task SendAsync(Guid userId, string type, string title, string body, string? actionUrl = null, CancellationToken ct = default);

    /// <summary>Batch-send the same notification to many users in a single DB round-trip.</summary>
    Task<int> SendManyAsync(IEnumerable<Guid> userIds, string type, string title, string body, string? actionUrl = null, CancellationToken ct = default);
}

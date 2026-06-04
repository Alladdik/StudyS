namespace LTropik.Application.Interfaces;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default);
    Task RemoveAsync(string key, CancellationToken ct = default);
    Task EnqueueAsync<T>(string queueKey, T message, CancellationToken ct = default);
    Task<T?> DequeueAsync<T>(string queueKey, CancellationToken ct = default);
}

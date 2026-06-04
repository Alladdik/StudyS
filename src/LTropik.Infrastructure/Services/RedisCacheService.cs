using System.Text.Json;
using LTropik.Application.Interfaces;
using StackExchange.Redis;

namespace LTropik.Infrastructure.Services;

public class RedisCacheService(IConnectionMultiplexer redis) : ICacheService
{
    // Returns null if Redis is not connected — graceful degradation
    private IDatabase? Db => redis.IsConnected ? redis.GetDatabase() : null;

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        if (Db is null) return default;
        try
        {
            var val = await Db.StringGetAsync(key);
            return val.IsNull ? default : JsonSerializer.Deserialize<T>(val!);
        }
        catch { return default; }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        if (Db is null) return;
        try
        {
            var json = JsonSerializer.Serialize(value);
            await Db.StringSetAsync(key, json, expiry);
        }
        catch { /* Redis unavailable — skip */ }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        if (Db is null) return;
        try { await Db.KeyDeleteAsync(key); } catch { }
    }

    public async Task EnqueueAsync<T>(string queueKey, T message, CancellationToken ct = default)
    {
        if (Db is null) return;
        try
        {
            var json = JsonSerializer.Serialize(message);
            await Db.ListRightPushAsync(queueKey, json);
        }
        catch { }
    }

    public async Task<T?> DequeueAsync<T>(string queueKey, CancellationToken ct = default)
    {
        if (Db is null) return default;
        try
        {
            var val = await Db.ListLeftPopAsync(queueKey);
            return val.IsNull ? default : JsonSerializer.Deserialize<T>(val!);
        }
        catch { return default; }
    }
}

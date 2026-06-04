using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace LTropik.Infrastructure.Services;

public class AppSettingsService(
    IApplicationDbContext db,
    IConfiguration config) : IAppSettingsService
{
    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row?.Value is not null)
            return row.Value;

        // fallback to appsettings.json using colon notation (e.g. "OpenAI:ApiKey")
        return config[key.Replace('.', ':')];
    }

    public async Task SetAsync(string key, string? value, CancellationToken ct = default)
    {
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is null)
        {
            db.AppSettings.Add(new AppSetting { Key = key, Value = value, IsSecret = IsSecretKey(key) });
        }
        else
        {
            row.Value = value;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<Dictionary<string, string?>> GetAllAsync(CancellationToken ct = default)
    {
        var rows = await db.AppSettings.ToListAsync(ct);
        return rows.ToDictionary(r => r.Key, r => r.IsSecret ? MaskSecret(r.Value) : r.Value);
    }

    private static bool IsSecretKey(string key) =>
        key.Contains("Key", StringComparison.OrdinalIgnoreCase) ||
        key.Contains("Token", StringComparison.OrdinalIgnoreCase) ||
        key.Contains("Password", StringComparison.OrdinalIgnoreCase) ||
        key.Contains("Secret", StringComparison.OrdinalIgnoreCase);

    private static string? MaskSecret(string? value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= 8 ? "••••••••" : value[..4] + new string('•', value.Length - 4);
    }
}

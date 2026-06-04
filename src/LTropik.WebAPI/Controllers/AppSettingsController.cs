using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AppSettingsController(
    IApplicationDbContext db,
    IAppSettingsService settingsService) : ControllerBase
{
    // Keys the admin is allowed to manage (whitelist prevents arbitrary config writes)
    private static readonly HashSet<string> AllowedKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "OpenAI:ApiKey", "OpenAI:Model",
        "Gemini:ApiKey", "Gemini:Model",
        "Telegram:BotToken",
        "Email:SmtpHost", "Email:SmtpPort", "Email:FromAddress", "Email:FromName",
        "Email:Username", "Email:Password",
        "Frontend:Url",
    };

    private static readonly HashSet<string> SecretKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "OpenAI:ApiKey", "Gemini:ApiKey", "Telegram:BotToken", "Email:Password"
    };

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await db.AppSettings.ToListAsync(ct);
        var result = AllowedKeys.ToDictionary(
            k => k,
            k =>
            {
                var row = rows.FirstOrDefault(r => string.Equals(r.Key, k, StringComparison.OrdinalIgnoreCase));
                var value = row?.Value;
                var isSecret = SecretKeys.Contains(k);
                return new
                {
                    value = isSecret ? MaskSecret(value) : value,
                    isSecret,
                    isSet = !string.IsNullOrEmpty(value)
                };
            });

        return Ok(result);
    }

    [HttpPut]
    public async Task<IActionResult> BulkUpdate([FromBody] Dictionary<string, string?> updates, CancellationToken ct)
    {
        foreach (var (key, value) in updates)
        {
            if (!AllowedKeys.Contains(key))
                return BadRequest(new { error = $"Ключ '{key}' не дозволено змінювати." });

            var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
            if (row is null)
            {
                db.AppSettings.Add(new AppSetting
                {
                    Key = key,
                    Value = string.IsNullOrWhiteSpace(value) ? null : value,
                    IsSecret = SecretKeys.Contains(key)
                });
            }
            else
            {
                row.Value = string.IsNullOrWhiteSpace(value) ? null : value;
                row.IsSecret = SecretKeys.Contains(key);
            }
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { updated = updates.Count });
    }

    // Test Telegram bot connection
    [HttpPost("test/telegram")]
    public async Task<IActionResult> TestTelegram(CancellationToken ct)
    {
        var token = await settingsService.GetAsync("Telegram:BotToken", ct);
        if (string.IsNullOrEmpty(token))
            return BadRequest(new { error = "BotToken не налаштовано" });

        using var http = new HttpClient();
        var response = await http.GetAsync($"https://api.telegram.org/bot{token}/getMe", ct);
        if (!response.IsSuccessStatusCode)
            return BadRequest(new { error = "Невірний BotToken або Telegram недоступний" });

        var json = await response.Content.ReadAsStringAsync(ct);
        return Ok(new { ok = true, raw = json });
    }

    // Test OpenAI/Gemini key
    [HttpPost("test/ai")]
    public async Task<IActionResult> TestAi([FromServices] IAiCoreService ai, CancellationToken ct)
    {
        try
        {
            var result = await ai.GetTutorResponseAsync(Guid.Empty, "Привіт", [], ct);
            return Ok(new { ok = true, preview = result.Length > 100 ? result[..100] + "…" : result });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private static string? MaskSecret(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        return value.Length <= 8 ? "••••••••" : value[..4] + new string('•', Math.Min(value.Length - 4, 20));
    }
}

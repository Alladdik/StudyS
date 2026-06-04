using System.Text.Json;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TelegramController(
    ITelegramBotService botService,
    IConfiguration config) : ControllerBase
{
    // Telegram sends POST to this endpoint for every message
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(
        [FromBody] JsonElement update,
        [FromHeader(Name = "X-Telegram-Bot-Api-Secret-Token")] string? secretToken,
        CancellationToken ct)
    {
        var expected = config["Telegram:WebhookSecret"];
        if (!string.IsNullOrEmpty(expected) && secretToken != expected)
            return Unauthorized();

        await botService.HandleUpdateAsync(update, ct);
        return Ok();
    }

    // Admin can call this to register/update the webhook URL
    [HttpPost("set-webhook")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetWebhook(
        [FromQuery] string url,
        CancellationToken ct)
    {
        var token  = config["Telegram:BotToken"];
        var secret = config["Telegram:WebhookSecret"] ?? "";

        if (string.IsNullOrEmpty(token))
            return BadRequest(new { error = "Telegram:BotToken не налаштовано" });

        using var client = new HttpClient();
        var response = await client.PostAsJsonAsync(
            $"https://api.telegram.org/bot{token}/setWebhook",
            new { url, secret_token = secret, allowed_updates = new[] { "message" } },
            ct);

        var body = await response.Content.ReadAsStringAsync(ct);
        return response.IsSuccessStatusCode ? Ok(body) : BadRequest(body);
    }
}

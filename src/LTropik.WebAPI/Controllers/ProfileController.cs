using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController(IApplicationDbContext db, AuthService auth) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET own profile
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var user = await db.Users.FindAsync([CurrentUserId], ct);
        if (user == null) return NotFound();

        return Ok(new
        {
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email,
            Role       = user.Role.ToString(),
            TelegramId = user.TelegramId,
            TelegramLinked = user.TelegramId != null,
            user.CreatedAt
        });
    }

    // PUT update own profile (name + optional password)
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateProfileRequest req, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([CurrentUserId], ct);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.FirstName)) user.FirstName = req.FirstName;
        if (!string.IsNullOrWhiteSpace(req.LastName))  user.LastName  = req.LastName;

        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (string.IsNullOrWhiteSpace(req.CurrentPassword))
                return BadRequest(new { error = "Для зміни пароля потрібен поточний пароль" });

            if (!AuthService.VerifyPassword(req.CurrentPassword, user.PasswordHash))
                return BadRequest(new { error = "Поточний пароль невірний" });

            user.PasswordHash = AuthService.HashPassword(req.NewPassword);
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { message = "Профіль оновлено" });
    }

    // POST generate a 6-char Telegram link code (stored in DB, valid until used)
    [HttpPost("telegram-code")]
    public async Task<IActionResult> GenerateTelegramCode(CancellationToken ct)
    {
        var user = await db.Users.FindAsync([CurrentUserId], ct);
        if (user == null) return NotFound();

        // Generate unique code
        string code;
        do
        {
            code = GenerateCode();
        } while (await db.Users.AnyAsync(u => u.TelegramLinkCode == code, ct));

        user.TelegramLinkCode = code;
        await db.SaveChangesAsync(ct);

        return Ok(new { code });
    }

    // DELETE unlink Telegram account
    [HttpDelete("telegram")]
    public async Task<IActionResult> UnlinkTelegram(CancellationToken ct)
    {
        var user = await db.Users.FindAsync([CurrentUserId], ct);
        if (user == null) return NotFound();

        user.TelegramId       = null;
        user.TelegramLinkCode = null;
        await db.SaveChangesAsync(ct);

        return Ok(new { message = "Telegram відключено" });
    }

    private static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var bytes = new byte[6];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
    }
}

public record UpdateProfileRequest(
    string? FirstName,
    string? LastName,
    string? CurrentPassword,
    string? NewPassword);

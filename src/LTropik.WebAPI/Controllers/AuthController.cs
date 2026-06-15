using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController(
    AuthService auth,
    IApplicationDbContext db,
    IEmailService email,
    IAppSettingsService settings) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        try { return Ok(await auth.LoginAsync(request, ct)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { error = ex.Message }); }
    }

    [HttpPost("verify-2fa")]
    public async Task<IActionResult> Verify2fa(Verify2faRequest request, CancellationToken ct)
    {
        try { return Ok(await auth.Verify2faAsync(request, ct)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { error = ex.Message }); }
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        try
        {
            var id = await auth.RegisterAsync(request, ct);

            // Send email verification (fire & forget — don't block registration)
            _ = Task.Run(async () =>
            {
                try
                {
                    var token = await auth.GenerateEmailVerifyTokenAsync(id, CancellationToken.None);
                    var frontendUrl = await settings.GetAsync("Frontend:Url", CancellationToken.None) ?? "http://localhost:5173";
                    var link = $"{frontendUrl}/verify-email?token={token}";
                    await email.SendAsync(request.Email, "Підтвердіть ваш email — LTropik",
                        $"""
                        <h2>Вітаємо в LTropik!</h2>
                        <p>Натисніть кнопку нижче щоб підтвердити ваш email:</p>
                        <a href="{link}" style="display:inline-block;padding:12px 28px;background:#6535f6;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold;">
                            ✅ Підтвердити email
                        </a>
                        <p style="color:#999;font-size:12px;">Посилання діє 24 години.</p>
                        """, ct: CancellationToken.None);
                }
                catch { /* email is optional — don't crash registration */ }
            }, CancellationToken.None);

            return CreatedAtAction(nameof(Login), new { id });
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // ── Email verification ────────────────────────────────────────────────────
    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest req, CancellationToken ct)
    {
        try
        {
            await auth.VerifyEmailAsync(req.Token, ct);
            return Ok(new { message = "Email підтверджено!" });
        }
        catch (UnauthorizedAccessException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // ── Password reset ────────────────────────────────────────────────────────
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        try
        {
            var token = await auth.GeneratePasswordResetTokenAsync(req.Email, ct);
            var frontendUrl = await settings.GetAsync("Frontend:Url", ct) ?? "http://localhost:5173";
            var link = $"{frontendUrl}/reset-password?token={token}";

            await email.SendAsync(req.Email, "Відновлення пароля — LTropik",
                $"""
                <h2>Відновлення пароля</h2>
                <p>Ви запросили скидання пароля. Натисніть кнопку нижче:</p>
                <a href="{link}" style="display:inline-block;padding:12px 28px;background:#6535f6;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold;">
                    🔑 Відновити пароль
                </a>
                <p style="color:#999;font-size:12px;">Посилання діє 30 хвилин. Якщо ви не запитували скидання — проігноруйте цей лист.</p>
                """, ct: ct);

            return Ok(new { message = "Лист відправлено. Перевірте пошту." });
        }
        catch (KeyNotFoundException)
        {
            // Don't reveal if email exists
            return Ok(new { message = "Якщо email зареєстровано — лист відправлено." });
        }
        catch (Exception)
        {
            return BadRequest(new { error = "Не вдалося надіслати лист. Перевірте налаштування Email у адмін панелі." });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        try
        {
            await auth.ResetPasswordAsync(req.Token, req.NewPassword, ct);
            return Ok(new { message = "Пароль успішно змінено!" });
        }
        catch (UnauthorizedAccessException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // ── Check email verified status ───────────────────────────────────────────
    [HttpGet("email-verified/{email}")]
    public async Task<IActionResult> CheckVerified(string email, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        return Ok(new { isVerified = user?.IsEmailVerified ?? false });
    }
}

public record VerifyEmailRequest(string Token);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);

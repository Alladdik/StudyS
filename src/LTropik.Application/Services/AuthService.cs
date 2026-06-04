using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace LTropik.Application.Services;

public class AuthService(
    IApplicationDbContext db,
    IConfiguration config,
    ICacheService cache,
    ITelegramNotificationService telegram)
{
    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive, ct)
            ?? throw new UnauthorizedAccessException("Невірний email або пароль");

        if (!VerifyPassword(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Невірний email або пароль");

        // 2FA: only if user has Telegram linked AND Redis is reachable
        if (user.TelegramId != null)
        {
            try
            {
                var code = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
                var pendingToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

                await cache.SetAsync($"2fa:{pendingToken}", new { userId = user.Id, code },
                    TimeSpan.FromMinutes(5), ct);
                await cache.SetAsync($"2fa_user:{user.Id}", code, TimeSpan.FromMinutes(5), ct);

                // Verify the code was actually stored (Redis is working)
                var check = await cache.GetAsync<object>($"2fa:{pendingToken}", ct);
                if (check != null)
                {
                    await telegram.Send2faCodeAsync(user.TelegramId, code, ct);
                    return new LoginResponse("", "", user.Role.ToString(), user.Id,
                        Requires2fa: true, PendingToken: pendingToken);
                }
                // Redis unavailable — fall through to normal login
            }
            catch
            {
                // Redis or Telegram unavailable — skip 2FA, log normally
            }
        }

        return new LoginResponse(
            GenerateJwt(user),
            GenerateRefreshToken(),
            user.Role.ToString(),
            user.Id
        );
    }

    public async Task<LoginResponse> Verify2faAsync(Verify2faRequest request, CancellationToken ct)
    {
        var stored = await cache.GetAsync<TwoFaPending>($"2fa:{request.PendingToken}", ct);
        if (stored == null)
            throw new UnauthorizedAccessException("Код недійсний або застарів");

        if (stored.code != request.Code)
        {
            // Invalidate the pending token immediately on wrong guess (brute-force protection)
            await cache.RemoveAsync($"2fa:{request.PendingToken}", ct);
            throw new UnauthorizedAccessException("Невірний код. Отримайте новий код і спробуйте знову.");
        }

        // Clean up both keys so codes can't be replayed
        await Task.WhenAll(
            cache.RemoveAsync($"2fa:{request.PendingToken}", ct),
            cache.RemoveAsync($"2fa_user:{stored.userId}", ct)
        );

        var user = await db.Users.FindAsync([stored.userId], ct)
            ?? throw new UnauthorizedAccessException("Користувача не знайдено");

        return new LoginResponse(
            GenerateJwt(user),
            GenerateRefreshToken(),
            user.Role.ToString(),
            user.Id
        );
    }

    private record TwoFaPending(Guid userId, string code);

    public async Task<Guid> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        if (await db.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new InvalidOperationException("Email вже зареєстровано");

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            throw new ArgumentException("Невідома роль");

        var user = new User
        {
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            FirstName = request.FirstName,
            LastName = request.LastName,
            Role = role,
            TelegramLinkCode = GenerateTelegramCode()
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return user.Id;
    }

    public string GenerateToken(User user)
    {
        return GenerateJwt(user);
    }

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes(
            password, salt, 100_000, HashAlgorithmName.SHA256);
        var hash = pbkdf2.GetBytes(32);
        return Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(hash);
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split(':');
        if (parts.Length != 2)
        {
            // Backward-compat: legacy SHA256 format (no colon separator)
            using var sha = SHA256.Create();
            var legacy = Convert.ToBase64String(
                sha.ComputeHash(Encoding.UTF8.GetBytes(password + "ltropik_salt_v1")));
            return legacy == storedHash;
        }

        try
        {
            var salt = Convert.FromBase64String(parts[0]);
            var stored = Convert.FromBase64String(parts[1]);
            using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes(
                password, salt, 100_000, HashAlgorithmName.SHA256);
            var computed = pbkdf2.GetBytes(32);
            return CryptographicOperations.FixedTimeEquals(computed, stored);
        }
        catch
        {
            return false;
        }
    }

    private static string GenerateRefreshToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    private static string GenerateTelegramCode() =>
        RandomNumberGenerator.GetInt32(100000, 999999).ToString();

    // ── Password reset ────────────────────────────────────────────────────────
    public async Task<string> GeneratePasswordResetTokenAsync(string email, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct)
            ?? throw new KeyNotFoundException("Email не знайдено");

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLower();
        await cache.SetAsync($"pw_reset:{token}", user.Id.ToString(), TimeSpan.FromMinutes(30), ct);
        return token;
    }

    public async Task ResetPasswordAsync(string token, string newPassword, CancellationToken ct)
    {
        var userIdStr = await cache.GetAsync<string>($"pw_reset:{token}", ct)
            ?? throw new UnauthorizedAccessException("Токен недійсний або прострочений");

        var user = await db.Users.FindAsync([Guid.Parse(userIdStr)], ct)
            ?? throw new KeyNotFoundException();

        user.PasswordHash = HashPassword(newPassword);
        await db.SaveChangesAsync(ct);
        await cache.RemoveAsync($"pw_reset:{token}", ct);
    }

    // ── Email verification ────────────────────────────────────────────────────
    public async Task<string> GenerateEmailVerifyTokenAsync(Guid userId, CancellationToken ct)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLower();
        await cache.SetAsync($"verify_email:{token}", userId.ToString(), TimeSpan.FromHours(24), ct);
        return token;
    }

    public async Task VerifyEmailAsync(string token, CancellationToken ct)
    {
        var userIdStr = await cache.GetAsync<string>($"verify_email:{token}", ct)
            ?? throw new UnauthorizedAccessException("Токен недійсний або прострочений");

        var user = await db.Users.FindAsync([Guid.Parse(userIdStr)], ct)
            ?? throw new KeyNotFoundException();

        user.IsEmailVerified = true;
        await db.SaveChangesAsync(ct);
        await cache.RemoveAsync($"verify_email:{token}", ct);
    }
}

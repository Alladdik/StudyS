using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/admin/system-health")]
[Authorize(Roles = "Admin")]
public class SystemController(IApplicationDbContext db, ICacheService cache) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetHealth(CancellationToken ct)
    {
        var proc = System.Diagnostics.Process.GetCurrentProcess();

        // proc.StartTime throws on Linux/Docker — guard it
        TimeSpan uptime = TimeSpan.Zero;
        long memoryMb = 0;
        int threads = 0;
        string? processError = null;
        try
        {
            var startTime = proc.StartTime.ToUniversalTime();
            uptime    = DateTime.UtcNow - startTime;
            memoryMb  = proc.WorkingSet64 / (1024 * 1024);
            threads   = proc.Threads.Count;
        }
        catch (Exception ex) { processError = ex.Message; }

        // Check DB
        bool dbOk = false;
        string dbError = "";
        long userCount = 0;
        try
        {
            userCount = await db.Users.CountAsync(ct);
            dbOk = true;
        }
        catch (Exception ex) { dbError = ex.Message; }

        // Check Redis — always remove key even if GetAsync throws
        bool redisOk = false;
        string redisError = "";
        try
        {
            var key = $"health_check_{Guid.NewGuid():N}";
            await cache.SetAsync(key, "ok", TimeSpan.FromSeconds(10), ct);
            try
            {
                var val = await cache.GetAsync<string>(key, ct);
                redisOk = val == "ok";
            }
            finally
            {
                await cache.RemoveAsync(key, CancellationToken.None);
            }
        }
        catch (Exception ex) { redisError = ex.Message; }

        return Ok(new
        {
            db = new
            {
                status = dbOk ? "OK" : "ERROR",
                error = dbError.Length > 0 ? dbError : null,
                userCount,
            },
            redis = new
            {
                status = redisOk ? "OK" : "ERROR",
                error = redisError.Length > 0 ? redisError : null,
            },
            process = new
            {
                uptimeSeconds = (long)uptime.TotalSeconds,
                uptimeHuman   = $"{(int)uptime.TotalHours}г {uptime.Minutes}хв {uptime.Seconds}с",
                memoryMb,
                threads,
                error = processError,
            },
            generatedAt = DateTime.UtcNow,
        });
    }
}

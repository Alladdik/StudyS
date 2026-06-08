using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Diagnostics;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class HealthController(
    IApplicationDbContext db,
    IConnectionMultiplexer redis) : ControllerBase
{
    private static readonly DateTime _startTime = DateTime.UtcNow;

    // Public liveness probe — used by the deploy pipeline to confirm the app is
    // actually up after a restart. No auth so CI / external checks can hit it.
    [AllowAnonymous]
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow });

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var proc   = Process.GetCurrentProcess();
        var uptime = DateTime.UtcNow - _startTime;

        // ── DB ────────────────────────────────────────────────────────────────
        string dbStatus = "ok";
        long dbPingMs   = -1;
        try
        {
            var sw = Stopwatch.StartNew();
            await (db as DbContext)!.Database.ExecuteSqlRawAsync("SELECT 1", ct);
            sw.Stop();
            dbPingMs = sw.ElapsedMilliseconds;
        }
        catch (Exception ex) { dbStatus = ex.Message[..Math.Min(60, ex.Message.Length)]; }

        // ── Redis ─────────────────────────────────────────────────────────────
        string redisStatus = "ok";
        long redisPingMs   = -1;
        try
        {
            var sw = Stopwatch.StartNew();
            await redis.GetDatabase().PingAsync();
            sw.Stop();
            redisPingMs = sw.ElapsedMilliseconds;
        }
        catch (Exception ex) { redisStatus = ex.Message[..Math.Min(60, ex.Message.Length)]; }

        // ── Counts ────────────────────────────────────────────────────────────
        var userCount   = await db.Users.CountAsync(ct);
        var courseCount = await db.Courses.CountAsync(ct);

        return Ok(new
        {
            status  = dbStatus == "ok" ? "healthy" : "degraded",
            uptime  = $"{(int)uptime.TotalDays}д {uptime.Hours}г {uptime.Minutes}хв",
            uptimeSeconds = (long)uptime.TotalSeconds,
            database = new { status = dbStatus, pingMs = dbPingMs },
            redis    = new { status = redisStatus, pingMs = redisPingMs, connected = redis.IsConnected },
            memory = new
            {
                workingSetMb  = proc.WorkingSet64 / 1024 / 1024,
                privateMemMb  = proc.PrivateMemorySize64 / 1024 / 1024,
                gcTotalMb     = GC.GetTotalMemory(false) / 1024 / 1024,
            },
            stats = new { userCount, courseCount },
            timestamp = DateTimeOffset.UtcNow,
        });
    }
}

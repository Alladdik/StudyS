using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "Admin")]
public class AuditLogsController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? action,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        // Clamp to prevent Skip(-N) crash when page=0 or negative
        var safePage     = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 200);

        var q = db.AuditLogs
            .Include(l => l.User)
            .AsQueryable();

        if (!string.IsNullOrEmpty(search))
            // Guard l.User null — some audit logs have no user (system actions)
            q = q.Where(l =>
                l.Action.Contains(search) ||
                l.Details.Contains(search) ||
                (l.User != null && (
                    l.User.Email.Contains(search) ||
                    l.User.FirstName.Contains(search) ||
                    l.User.LastName.Contains(search))));

        if (!string.IsNullOrEmpty(action))
            q = q.Where(l => l.Action == action);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(l => l.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(l => new
            {
                l.Id,
                l.Action,
                l.Details,
                l.IpAddress,
                l.CreatedAt,
                // l.User is nullable — system actions have no user
                UserName  = l.User != null ? $"{l.User.FirstName} {l.User.LastName}" : "Система",
                UserEmail = l.User != null ? l.User.Email : null,
            })
            .ToListAsync(ct);

        return Ok(new { total, page = safePage, pageSize = safePageSize, items });
    }

    [HttpGet("actions")]
    public async Task<IActionResult> GetDistinctActions(CancellationToken ct = default)
    {
        var actions = await db.AuditLogs
            .Select(l => l.Action)
            .Distinct()
            .OrderBy(a => a)
            .ToListAsync(ct);
        return Ok(actions);
    }
}

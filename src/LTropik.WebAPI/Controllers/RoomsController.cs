using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomsController(
    IApplicationDbContext db,
    IRoomPresenceService presence,
    INotificationService notificationService,
    IHubContext<RoomHub> roomHub) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateRoomRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { error = "Вкажіть назву кімнати" });

        var host = await db.Users.FindAsync([CurrentUserId], ct);
        var room = new Room
        {
            Title = req.Title.Trim(),
            HostId = CurrentUserId,
            CourseId = req.CourseId,
        };
        db.Rooms.Add(room);
        await db.SaveChangesAsync(ct);

        // Notify all enrolled students
        if (req.CourseId.HasValue)
        {
            var studentIds = await db.CourseStudents
                .Where(cs => cs.CourseId == req.CourseId)
                .Select(cs => cs.StudentId)
                .ToListAsync(ct);

            var hostName = host != null ? $"{host.FirstName} {host.LastName}" : "Викладач";
            var courseName = await db.Courses
                .Where(c => c.Id == req.CourseId)
                .Select(c => c.Title)
                .FirstOrDefaultAsync(ct) ?? "курс";

            foreach (var studentId in studentIds)
            {
                _ = notificationService.SendAsync(
                    studentId,
                    "RoomCreated",
                    $"📹 {hostName} відкрив кімнату",
                    $"Приєднуйся до «{room.Title}» — {courseName}",
                    $"/room/{room.Id}",
                    ct);
            }
        }

        return Ok(new { room.Id, room.Title, room.CourseId, room.CreatedAt });
    }

    [HttpGet]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var allCounts = presence.GetAllCounts();

        var rooms = await db.Rooms
            .Include(r => r.Host)
            .Include(r => r.Course)
            .Where(r => r.IsActive)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.Title,
                HostId = r.HostId,
                HostName = r.Host.FirstName + " " + r.Host.LastName,
                CourseName = r.Course != null ? r.Course.Title : null,
                r.CreatedAt,
            })
            .ToListAsync(ct);

        var result = rooms.Select(r => new
        {
            r.Id,
            r.Title,
            r.HostId,
            r.HostName,
            r.CourseName,
            r.CreatedAt,
            ParticipantCount = allCounts.TryGetValue(r.Id.ToString(), out var c) ? c : 0,
        });

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var room = await db.Rooms
            .Include(r => r.Host)
            .Include(r => r.Course)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (room == null) return NotFound(new { error = "Кімнату не знайдено" });
        if (!room.IsActive) return StatusCode(410, new { error = "Кімнату вже завершено" });

        var messages = await db.RoomMessages
            .Include(m => m.User)
            .Where(m => m.RoomId == id)
            .OrderBy(m => m.SentAt)
            .Take(100)
            .Select(m => new
            {
                m.Id,
                m.UserId,
                DisplayName = m.User.FirstName + " " + m.User.LastName,
                Content = m.Content,
                m.SentAt,
            })
            .ToListAsync(ct);

        var participants = presence.GetParticipants(id.ToString())
            .Select(p => new { p.UserId, p.DisplayName, p.ConnectionId })
            .ToList();

        return Ok(new
        {
            room.Id,
            room.Title,
            HostId = room.HostId,
            HostName = room.Host.FirstName + " " + room.Host.LastName,
            CourseName = room.Course?.Title,
            room.IsActive,
            room.CreatedAt,
            ParticipantCount = presence.GetCount(id.ToString()),
            Participants = participants,
            Messages = messages,
        });
    }

    [HttpGet("{id:guid}/participants")]
    public IActionResult GetParticipants(Guid id)
    {
        var participants = presence.GetParticipants(id.ToString())
            .Select(p => new { p.UserId, p.DisplayName })
            .ToList();
        return Ok(new { count = participants.Count, participants });
    }

    // ── End: deactivate + kick everyone via SignalR ────────────────────────
    [HttpPost("{id:guid}/end")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> End(Guid id, CancellationToken ct)
    {
        var room = await db.Rooms.FindAsync([id], ct);
        if (room == null) return NotFound();
        if (!User.IsInRole("Admin") && room.HostId != CurrentUserId) return Forbid();

        room.IsActive = false;
        await db.SaveChangesAsync(ct);

        // Kick everyone still connected
        await roomHub.Clients.Group(id.ToString())
            .SendAsync("RoomEnded", new { reason = "ended", roomId = id }, ct);

        return Ok();
    }

    // ── Delete: permanently remove room + chat history ─────────────────────
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var room = await db.Rooms.FindAsync([id], ct);
        if (room == null) return NotFound();
        if (!User.IsInRole("Admin") && room.HostId != CurrentUserId) return Forbid();

        // Notify connected clients before deletion
        await roomHub.Clients.Group(id.ToString())
            .SendAsync("RoomEnded", new { reason = "deleted", roomId = id }, ct);

        // Remove chat messages first (FK), then the room
        var messages = await db.RoomMessages.Where(m => m.RoomId == id).ToListAsync(ct);
        db.RoomMessages.RemoveRange(messages);
        db.Rooms.Remove(room);
        await db.SaveChangesAsync(ct);

        return Ok();
    }
}

public record CreateRoomRequest(string Title, Guid? CourseId);

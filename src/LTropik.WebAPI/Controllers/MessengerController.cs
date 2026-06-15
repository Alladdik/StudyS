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
public class MessengerController(
    IApplicationDbContext db,
    IHubContext<NotificationHub> hub) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Get list of conversations (users I've chatted with + unread count)
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations(CancellationToken ct)
    {
        var me = CurrentUserId;

        // Get distinct conversation partners
        var sentTo = await db.DirectMessages
            .Where(m => m.SenderId == me)
            .Select(m => m.ReceiverId)
            .Distinct()
            .ToListAsync(ct);

        var receivedFrom = await db.DirectMessages
            .Where(m => m.ReceiverId == me)
            .Select(m => m.SenderId)
            .Distinct()
            .ToListAsync(ct);

        var partnerIds = sentTo.Union(receivedFrom).ToList();

        var result = await db.Users
            .Where(u => partnerIds.Contains(u.Id))
            .Select(u => new
            {
                UserId    = u.Id,
                Name      = u.FirstName + " " + u.LastName,
                Role      = u.Role.ToString(),
                UnreadCount = db.DirectMessages.Count(m =>
                    m.SenderId == u.Id && m.ReceiverId == me && !m.IsRead),
                LastMessage = db.DirectMessages
                    .Where(m => (m.SenderId == me && m.ReceiverId == u.Id) ||
                                (m.SenderId == u.Id && m.ReceiverId == me))
                    .OrderByDescending(m => m.SentAt)
                    .Select(m => new { m.Content, m.SentAt, IsMine = m.SenderId == me })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        // Sort by last message time
        var sorted = result
            .OrderByDescending(c => c.LastMessage?.SentAt ?? DateTimeOffset.MinValue)
            .ToList();

        return Ok(sorted);
    }

    // Get all users I can message (classmates in same course, teachers of my courses, all if admin)
    [HttpGet("contacts")]
    public async Task<IActionResult> GetContacts(CancellationToken ct)
    {
        var me = CurrentUserId;
        var role = User.FindFirstValue(ClaimTypes.Role);

        IQueryable<Guid> contactIds;

        if (role == "Admin")
        {
            contactIds = db.Users.Where(u => u.Id != me && u.IsActive).Select(u => u.Id);
        }
        else if (role == "Teacher")
        {
            // My course students + other teachers
            var myCourseIds = db.CourseTeachers.Where(ct2 => ct2.TeacherId == me).Select(ct2 => ct2.CourseId);
            var studentIds  = db.CourseStudents.Where(cs => myCourseIds.Contains(cs.CourseId)).Select(cs => cs.StudentId);
            var teacherIds  = db.CourseTeachers.Select(ct2 => ct2.TeacherId).Distinct();
            contactIds = studentIds.Union(teacherIds).Where(id => id != me);
        }
        else if (role == "Student")
        {
            // Teachers of my courses + classmates
            var myCourseIds = db.CourseStudents.Where(cs => cs.StudentId == me).Select(cs => cs.CourseId);
            var teacherIds  = db.CourseTeachers.Where(ct2 => myCourseIds.Contains(ct2.CourseId)).Select(ct2 => ct2.TeacherId);
            var classmateIds = db.CourseStudents.Where(cs => myCourseIds.Contains(cs.CourseId) && cs.StudentId != me).Select(cs => cs.StudentId);
            contactIds = teacherIds.Union(classmateIds);
        }
        else // Parent
        {
            // Teachers of their children's courses
            var childIds  = db.ParentStudents.Where(ps => ps.ParentId == me).Select(ps => ps.StudentId);
            var courseIds = db.CourseStudents.Where(cs => childIds.Contains(cs.StudentId)).Select(cs => cs.CourseId);
            contactIds = db.CourseTeachers.Where(ct2 => courseIds.Contains(ct2.CourseId)).Select(ct2 => ct2.TeacherId);
        }

        var contacts = await db.Users
            .Where(u => contactIds.Contains(u.Id) && u.IsActive)
            .OrderBy(u => u.LastName)
            .Select(u => new
            {
                u.Id,
                Name  = u.FirstName + " " + u.LastName,
                Role  = u.Role.ToString(),
                u.Email
            })
            .ToListAsync(ct);

        return Ok(contacts);
    }

    // Get messages between me and another user
    [HttpGet("{partnerId:guid}")]
    public async Task<IActionResult> GetMessages(Guid partnerId, [FromQuery] int skip = 0, CancellationToken ct = default)
    {
        var me = CurrentUserId;

        // Mark unread as read
        var unread = await db.DirectMessages
            .Where(m => m.SenderId == partnerId && m.ReceiverId == me && !m.IsRead)
            .ToListAsync(ct);
        unread.ForEach(m => m.IsRead = true);
        if (unread.Count > 0) await db.SaveChangesAsync(ct);

        var messages = await db.DirectMessages
            .Where(m => (m.SenderId == me && m.ReceiverId == partnerId) ||
                        (m.SenderId == partnerId && m.ReceiverId == me))
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(50)
            .Select(m => new
            {
                m.Id,
                m.Content,
                m.SentAt,
                m.IsRead,
                IsMine = m.SenderId == me
            })
            .ToListAsync(ct);

        return Ok(messages.OrderBy(m => m.SentAt));
    }

    // Send a direct message
    [HttpPost("{partnerId:guid}")]
    public async Task<IActionResult> Send(Guid partnerId, [FromBody] SendMessageRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Content))
            return BadRequest(new { error = "Повідомлення порожнє" });

        var me = CurrentUserId;
        if (partnerId == me)
            return BadRequest(new { error = "Не можна надіслати повідомлення самому собі" });
        if (!await db.Users.AnyAsync(u => u.Id == partnerId && u.IsActive, ct))
            return NotFound(new { error = "Отримувача не знайдено" });

        var msg = new DirectMessage
        {
            SenderId   = me,
            ReceiverId = partnerId,
            Content    = req.Content.Trim()
        };
        db.DirectMessages.Add(msg);
        await db.SaveChangesAsync(ct);

        // Real-time push via SignalR
        await hub.Clients.User(partnerId.ToString())
            .SendAsync("DirectMessage", new
            {
                msg.Id,
                msg.Content,
                msg.SentAt,
                SenderId = me
            }, ct);

        return Ok(new { msg.Id, msg.SentAt });
    }

    // Course chat room messages (reuse existing Room infrastructure)
    [HttpGet("course/{courseId:guid}")]
    public async Task<IActionResult> GetCourseChat(Guid courseId, CancellationToken ct)
    {
        // Only members of the course (or admins/managers) may read its chat.
        var isMember = User.IsInRole("Admin") || User.IsInRole("Manager")
            || await db.CourseStudents.AnyAsync(cs => cs.CourseId == courseId && cs.StudentId == CurrentUserId, ct)
            || await db.CourseTeachers.AnyAsync(ct2 => ct2.CourseId == courseId && ct2.TeacherId == CurrentUserId, ct);
        if (!isMember) return Forbid();

        // Find or create persistent chat room for this course
        var room = await db.Rooms
            .FirstOrDefaultAsync(r => r.CourseId == courseId && r.Title == "💬 Чат курсу", ct);

        if (room == null) return Ok(new { roomId = (Guid?)null, messages = Array.Empty<object>() });

        var messages = await db.RoomMessages
            .Include(m => m.User)
            .Where(m => m.RoomId == room.Id)
            .OrderBy(m => m.SentAt)
            .Take(100)
            .Select(m => new
            {
                m.Id,
                m.Content,
                m.SentAt,
                UserId      = m.UserId,
                DisplayName = m.User.FirstName + " " + m.User.LastName,
                IsMine      = m.UserId == CurrentUserId
            })
            .ToListAsync(ct);

        return Ok(new { roomId = room.Id, messages });
    }
}

public record SendMessageRequest(string Content);

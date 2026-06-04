using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LTropik.WebAPI.Hubs;

[Authorize]
public class RoomHub(IApplicationDbContext db, IRoomPresenceService presence) : Hub
{
    private Guid CurrentUserId =>
        Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Join ──────────────────────────────────────────────────────────────
    public async Task JoinRoom(string roomId)
    {
        var user = await db.Users.FindAsync([CurrentUserId]);
        if (user == null) return;

        var displayName = $"{user.FirstName} {user.LastName}";
        presence.Join(roomId, Context.ConnectionId, CurrentUserId, displayName);
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        // Send existing participants to joiner
        var existing = presence.GetParticipants(roomId)
            .Where(p => p.ConnectionId != Context.ConnectionId)
            .Select(p => new { p.UserId, p.DisplayName, p.ConnectionId })
            .ToList();

        await Clients.Caller.SendAsync("ExistingParticipants", existing);

        // Notify others of new joiner
        await Clients.OthersInGroup(roomId).SendAsync("ParticipantJoined", new
        {
            UserId = CurrentUserId,
            user.FirstName,
            user.LastName,
            DisplayName = displayName,
            ConnectionId = Context.ConnectionId,
        });

        // Broadcast updated participant count
        await Clients.Group(roomId).SendAsync("ParticipantCount", presence.GetCount(roomId));
    }

    // ── Leave ─────────────────────────────────────────────────────────────
    public async Task LeaveRoom(string roomId)
    {
        presence.Leave(roomId, Context.ConnectionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

        await Clients.OthersInGroup(roomId).SendAsync("ParticipantLeft", new
        {
            UserId = CurrentUserId,
            ConnectionId = Context.ConnectionId,
        });
        await Clients.Group(roomId).SendAsync("ParticipantCount", presence.GetCount(roomId));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Find and clean up all rooms this connection belongs to
        foreach (var roomId in presence.GetAllCounts().Keys.ToList())
        {
            var inRoom = presence.GetParticipants(roomId).Any(p => p.ConnectionId == Context.ConnectionId);
            if (!inRoom) continue;

            presence.Leave(roomId, Context.ConnectionId);
            await Clients.OthersInGroup(roomId).SendAsync("ParticipantLeft", new
            {
                UserId = CurrentUserId,
                ConnectionId = Context.ConnectionId,
            });
            await Clients.Group(roomId).SendAsync("ParticipantCount", presence.GetCount(roomId));
        }
        await base.OnDisconnectedAsync(exception);
    }

    // ── WebRTC signaling ──────────────────────────────────────────────────
    public async Task SendOffer(string roomId, string targetConnectionId, string sdp)
    {
        var user = await db.Users.FindAsync([CurrentUserId]);
        await Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", new
        {
            FromConnectionId = Context.ConnectionId,
            FromUserId = CurrentUserId,
            DisplayName = $"{user?.FirstName} {user?.LastName}",
            Sdp = sdp,
        });
    }

    public async Task SendAnswer(string roomId, string targetConnectionId, string sdp)
        => await Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", new
        {
            FromConnectionId = Context.ConnectionId,
            Sdp = sdp,
        });

    public async Task SendIceCandidate(string roomId, string targetConnectionId, string candidate)
        => await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", new
        {
            FromConnectionId = Context.ConnectionId,
            Candidate = candidate,
        });

    // ── Media state ───────────────────────────────────────────────────────
    public async Task SetMediaState(string roomId, bool micOn, bool cameraOn)
        => await Clients.OthersInGroup(roomId).SendAsync("ParticipantMediaState", new
        {
            UserId = CurrentUserId,
            ConnectionId = Context.ConnectionId,
            MicOn = micOn,
            CameraOn = cameraOn,
        });

    public async Task StartScreenShare(string roomId)
        => await Clients.OthersInGroup(roomId).SendAsync("ScreenShareStarted", new
        {
            UserId = CurrentUserId,
            ConnectionId = Context.ConnectionId,
        });

    public async Task StopScreenShare(string roomId)
        => await Clients.OthersInGroup(roomId).SendAsync("ScreenShareStopped", new
        {
            UserId = CurrentUserId,
        });

    // ── Chat ──────────────────────────────────────────────────────────────
    public async Task SendChatMessage(string roomId, string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return;
        if (!Guid.TryParse(roomId, out var roomGuid)) return;

        var user = await db.Users.FindAsync([CurrentUserId]);
        var msg = new RoomMessage
        {
            RoomId = roomGuid,
            UserId = CurrentUserId,
            Content = content.Trim(),
        };
        db.RoomMessages.Add(msg);
        await db.SaveChangesAsync();

        await Clients.Group(roomId).SendAsync("ReceiveChatMessage", new
        {
            msg.Id,
            UserId = CurrentUserId,
            DisplayName = $"{user?.FirstName} {user?.LastName}",
            Content = msg.Content,
            SentAt = msg.SentAt,
        });
    }

    // ── Whiteboard ────────────────────────────────────────────────────────
    public async Task SendStroke(string roomId, string strokeData)
        => await Clients.OthersInGroup(roomId).SendAsync("ReceiveStroke", strokeData);

    public async Task ClearWhiteboard(string roomId)
        => await Clients.OthersInGroup(roomId).SendAsync("WhiteboardCleared");

    public async Task SendTextOnBoard(string roomId, string textData)
        => await Clients.OthersInGroup(roomId).SendAsync("ReceiveTextOnBoard", textData);

    // ── Hand raise ────────────────────────────────────────────────────────
    public async Task RaiseHand(string roomId)
    {
        var user = await db.Users.FindAsync([CurrentUserId]);
        await Clients.Group(roomId).SendAsync("HandRaised", new
        {
            UserId = CurrentUserId,
            DisplayName = $"{user?.FirstName} {user?.LastName}",
        });
    }

    public async Task LowerHand(string roomId)
        => await Clients.Group(roomId).SendAsync("HandLowered", new { UserId = CurrentUserId });
}

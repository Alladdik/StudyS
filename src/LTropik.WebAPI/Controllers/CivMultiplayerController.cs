using System.Collections.Concurrent;
using System.Security.Claims;
using LTropik.WebAPI.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace LTropik.WebAPI.Controllers;

public record CivRoomState(
    string Code,
    string HostId, string HostName,
    string? GuestId, string? GuestName,
    string? HostCiv, string? GuestCiv,
    bool HostReady, bool GuestReady,
    string? GameStateJson,
    string? CurrentTurnPlayerId,
    int Turn,
    DateTime CreatedAt
);

[ApiController]
[Route("api/civ")]
[Authorize]
public class CivMultiplayerController(IHubContext<CivHub> hub) : ControllerBase
{
    private static readonly ConcurrentDictionary<string, CivRoomState> Rooms = new();

    private string Me => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private string MyName
    {
        get
        {
            var first = User.FindFirstValue("firstName") ?? "";
            var last  = User.FindFirstValue("lastName")  ?? "";
            var email = User.FindFirstValue(ClaimTypes.Email) ?? Me;
            var name  = $"{first} {last}".Trim();
            return string.IsNullOrEmpty(name) ? email : name;
        }
    }

    // ── Create room ───────────────────────────────────────────────────────────
    [HttpPost("rooms")]
    public IActionResult Create()
    {
        var code = GenCode();
        Rooms[code] = new CivRoomState(
            Code: code, HostId: Me, HostName: MyName,
            GuestId: null, GuestName: null,
            HostCiv: null, GuestCiv: null,
            HostReady: false, GuestReady: false,
            GameStateJson: null, CurrentTurnPlayerId: Me,
            Turn: 1, CreatedAt: DateTime.UtcNow);
        return Ok(new { code });
    }

    // ── Get room state ────────────────────────────────────────────────────────
    [HttpGet("rooms/{code}")]
    public IActionResult Get(string code)
    {
        if (!Rooms.TryGetValue(code, out var r)) return NotFound(new { error = "Кімната не знайдена" });
        return Ok(r);
    }

    // ── Join room ─────────────────────────────────────────────────────────────
    [HttpPost("rooms/{code}/join")]
    public async Task<IActionResult> Join(string code)
    {
        if (!Rooms.TryGetValue(code, out var r)) return NotFound(new { error = "Кімната не знайдена" });
        if (r.GuestId != null && r.GuestId != Me) return Conflict(new { error = "Кімната вже зайнята" });

        Rooms[code] = r with { GuestId = Me, GuestName = MyName };
        await hub.Clients.Group($"civ_{code}").SendAsync("CivPlayerJoined", new
        {
            userId = Me, name = MyName
        });
        return Ok(Rooms[code]);
    }

    // ── Set ready + civ ───────────────────────────────────────────────────────
    [HttpPost("rooms/{code}/ready")]
    public async Task<IActionResult> Ready(string code, [FromBody] CivReadyRequest req)
    {
        if (!Rooms.TryGetValue(code, out var r)) return NotFound();

        var updated = r.HostId == Me
            ? r with { HostReady = true, HostCiv = req.CivId }
            : r with { GuestReady = true, GuestCiv = req.CivId };

        Rooms[code] = updated;

        if (updated.HostReady && updated.GuestReady && updated.GuestId != null)
        {
            await hub.Clients.Group($"civ_{code}").SendAsync("CivGameStart", new
            {
                hostId   = updated.HostId,   hostCiv   = updated.HostCiv,
                guestId  = updated.GuestId,  guestCiv  = updated.GuestCiv,
                firstTurn = updated.HostId
            });
        }
        else
        {
            await hub.Clients.Group($"civ_{code}").SendAsync("CivPlayerReady", new
            {
                userId = Me, civId = req.CivId
            });
        }
        return Ok(Rooms[code]);
    }

    // ── Submit turn ────────────────────────────────────────────────────────────
    [HttpPost("rooms/{code}/turn")]
    public async Task<IActionResult> SubmitTurn(string code, [FromBody] CivTurnSubmit req)
    {
        if (!Rooms.TryGetValue(code, out var r)) return NotFound();
        if (r.CurrentTurnPlayerId != Me) return Forbid();

        var nextPlayer = r.CurrentTurnPlayerId == r.HostId ? r.GuestId : r.HostId;
        var newTurn    = r.Turn + 1;

        Rooms[code] = r with
        {
            GameStateJson        = req.StateJson,
            CurrentTurnPlayerId  = nextPlayer,
            Turn                 = newTurn
        };

        await hub.Clients.Group($"civ_{code}").SendAsync("CivTurnUpdate", new
        {
            stateJson            = req.StateJson,
            currentTurnPlayerId  = nextPlayer,
            turn                 = newTurn
        });
        return Ok(new { turn = newTurn, currentTurnPlayerId = nextPlayer });
    }

    // ── Chat / ping ────────────────────────────────────────────────────────────
    [HttpPost("rooms/{code}/chat")]
    public async Task<IActionResult> Chat(string code, [FromBody] CivChatMsg msg)
    {
        if (!Rooms.TryGetValue(code, out _)) return NotFound();
        await hub.Clients.Group($"civ_{code}").SendAsync("CivChat", new
        {
            from = MyName, text = msg.Text, at = DateTime.UtcNow
        });
        return Ok();
    }

    // ── Leave / close ──────────────────────────────────────────────────────────
    [HttpDelete("rooms/{code}")]
    public async Task<IActionResult> Leave(string code)
    {
        Rooms.TryRemove(code, out _);
        await hub.Clients.Group($"civ_{code}").SendAsync("CivRoomClosed", new { by = MyName });
        return Ok();
    }

    private static string GenCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return new string(Enumerable.Range(0, 6).Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
    }
}

public record CivReadyRequest(string CivId);
public record CivTurnSubmit(string StateJson);
public record CivChatMsg(string Text);

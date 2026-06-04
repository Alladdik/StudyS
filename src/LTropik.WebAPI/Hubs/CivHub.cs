using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LTropik.WebAPI.Hubs;

[Authorize]
public class CivHub : Hub
{
    public async Task JoinRoom(string code) =>
        await Groups.AddToGroupAsync(Context.ConnectionId, $"civ_{code}");

    public async Task LeaveRoom(string code) =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"civ_{code}");
}

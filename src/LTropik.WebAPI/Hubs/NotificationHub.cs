using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LTropik.WebAPI.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"notif_{userId}");
        await base.OnConnectedAsync();
    }
}

public class NotificationHubProxy(IHubContext<NotificationHub> hub) : INotificationHub
{
    public async Task PushAsync(Guid userId, object payload)
    {
        await hub.Clients
            .Group($"notif_{userId}")
            .SendAsync("Notification", payload);
    }
}

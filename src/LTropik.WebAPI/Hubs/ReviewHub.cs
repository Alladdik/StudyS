using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace LTropik.WebAPI.Hubs;

[Authorize]
public class ReviewHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        await base.OnConnectedAsync();
    }
}

public class ReviewNotificationHub(IHubContext<ReviewHub> hub) : IReviewNotificationHub
{
    public async Task NotifyReviewReadyAsync(Guid teacherId, Guid submissionId)
    {
        await hub.Clients
            .Group($"user_{teacherId}")
            .SendAsync("ReviewReady", new { submissionId });
    }
}

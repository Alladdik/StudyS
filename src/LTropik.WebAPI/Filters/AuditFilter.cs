using System.Security.Claims;
using LTropik.Infrastructure.BackgroundServices;
using Microsoft.AspNetCore.Mvc.Filters;

namespace LTropik.WebAPI.Filters;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class AuditAttribute(string action) : Attribute
{
    public string Action { get; } = action;
}

public class AuditFilter(AuditLogChannel channel) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var auditAttr = context.ActionDescriptor.EndpointMetadata
            .OfType<AuditAttribute>()
            .FirstOrDefault();

        var result = await next();

        if (auditAttr == null) return;
        if (result.Exception != null) return;

        var userId = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(userId, out var userGuid);

        string details;
        try
        {
            var serializableArgs = context.ActionArguments
                .Where(x => x.Value is not CancellationToken)
                .ToDictionary(x => x.Key, x => x.Value);

            details = System.Text.Json.JsonSerializer.Serialize(
                serializableArgs,
                new System.Text.Json.JsonSerializerOptions { WriteIndented = false });
        }
        catch (System.Exception ex)
        {
            details = $"{{\"error\":\"Failed to serialize arguments: {ex.Message}\"}}";
        }

        var ip = context.HttpContext.Connection.RemoteIpAddress?.ToString();

        await channel.Writer.WriteAsync(new AuditLogEntry(
            userGuid == Guid.Empty ? null : userGuid,
            auditAttr.Action,
            details,
            ip));
    }
}

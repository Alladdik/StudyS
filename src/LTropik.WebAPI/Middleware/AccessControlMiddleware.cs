using System.Security.Claims;
using LTropik.Application.Interfaces;

namespace LTropik.WebAPI.Middleware;

public class AccessControlMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx, IBillingService billing)
    {
        if (ctx.Request.Path.StartsWithSegments("/api/lessons") && ctx.Request.Method == "GET")
        {
            var userIdStr = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = ctx.User.FindFirstValue(ClaimTypes.Role);

            if (role is "Student" && Guid.TryParse(userIdStr, out var userId))
            {
                if (ctx.Request.Query.TryGetValue("courseId", out var courseIdStr) &&
                    Guid.TryParse(courseIdStr, out var courseId))
                {
                    var hasAccess = await billing.HasActiveAccessAsync(userId, courseId, ctx.RequestAborted);
                    if (!hasAccess)
                    {
                        ctx.Response.StatusCode = 403;
                        await ctx.Response.WriteAsJsonAsync(new
                        {
                            error = "Доступ заблоковано. Необхідно подовжити оплату."
                        });
                        return;
                    }
                }
            }
        }

        await next(ctx);
    }
}

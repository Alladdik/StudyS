using System.Text.Json;

namespace LTropik.WebAPI.Middleware;

/// <summary>
/// Converts unhandled exceptions into clean JSON responses instead of leaking raw
/// 500s. Service-layer exceptions (e.g. TestEngineService throwing
/// InvalidOperationException / KeyNotFoundException) now map to sensible status
/// codes with a consistent { error } body matching the controllers' convention.
/// </summary>
public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (Exception ex)
        {
            var (status, message) = ex switch
            {
                KeyNotFoundException        => (StatusCodes.Status404NotFound,   ex.Message),
                InvalidOperationException   => (StatusCodes.Status400BadRequest,  ex.Message),
                ArgumentException           => (StatusCodes.Status400BadRequest,  ex.Message),
                UnauthorizedAccessException => (StatusCodes.Status403Forbidden,   "Доступ заборонено"),
                _                           => (StatusCodes.Status500InternalServerError, "Внутрішня помилка сервера. Спробуйте пізніше.")
            };

            if (status == StatusCodes.Status500InternalServerError)
                logger.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            else
                logger.LogWarning("Handled {Exception} on {Method} {Path}: {Message}",
                    ex.GetType().Name, ctx.Request.Method, ctx.Request.Path, ex.Message);

            if (ctx.Response.HasStarted)
            {
                logger.LogWarning("Response already started; cannot write error body for {Path}", ctx.Request.Path);
                return;
            }

            ctx.Response.Clear();
            ctx.Response.StatusCode = status;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
        }
    }
}

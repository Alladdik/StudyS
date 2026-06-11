using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BillingController(IBillingService billing) : ControllerBase
{
    [HttpPost("webhook/stripe")]
    [AllowAnonymous]
    public async Task<IActionResult> StripeWebhook(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(ct);

        Request.Headers.TryGetValue("Stripe-Signature", out var signature);

        try
        {
            await billing.HandleStripeWebhookAsync(payload, signature.ToString(), ct);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }

        return Ok();
    }

    [HttpPost("webhook/wayforpay")]
    [AllowAnonymous]
    public async Task<IActionResult> WayForPayWebhook(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(ct);

        try
        {
            await billing.HandleWayForPayWebhookAsync(payload, ct);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }

        return Ok(new { status = "accept" });
    }

    [HttpGet("access/{courseId:guid}")]
    [Authorize]
    public async Task<IActionResult> CheckAccess(Guid courseId, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        var hasAccess = await billing.HasActiveAccessAsync(userId, courseId, ct);
        return Ok(new { hasAccess });
    }
}

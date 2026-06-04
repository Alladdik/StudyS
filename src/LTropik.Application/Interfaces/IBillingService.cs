namespace LTropik.Application.Interfaces;

public interface IBillingService
{
    Task HandleStripeWebhookAsync(string payload, string signature, CancellationToken ct = default);
    Task HandleWayForPayWebhookAsync(string payload, CancellationToken ct = default);
    Task<bool> HasActiveAccessAsync(Guid studentId, Guid courseId, CancellationToken ct = default);
}

using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LTropik.Application.Services;

public class BillingService(
    IApplicationDbContext db,
    ITelegramNotificationService telegram,
    ILogger<BillingService> logger) : IBillingService
{
    // Stripe webhook handler
    public async Task HandleStripeWebhookAsync(string payload, string signature, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(signature))
        {
            logger.LogWarning("Stripe webhook rejected: missing Stripe-Signature header");
            throw new UnauthorizedAccessException("Missing Stripe-Signature");
        }

        using var doc = JsonDocument.Parse(payload);
        var eventType = doc.RootElement.GetProperty("type").GetString();

        if (eventType != "checkout.session.completed" && eventType != "payment_intent.succeeded")
            return;

        var dataObj = doc.RootElement.GetProperty("data").GetProperty("object");
        var externalId = dataObj.GetProperty("id").GetString() ?? "";
        var amountCents = dataObj.TryGetProperty("amount_total", out var amt) ? amt.GetInt64() : 0;
        var metadata = dataObj.TryGetProperty("metadata", out var meta) ? meta : default;

        if (!metadata.TryGetProperty("student_id", out var sidEl) ||
            !Guid.TryParse(sidEl.GetString(), out var studentId))
            return;

        metadata.TryGetProperty("course_id", out var cidEl);
        Guid.TryParse(cidEl.GetString(), out var courseId);

        metadata.TryGetProperty("package_type", out var pkgEl);
        var packageType = pkgEl.GetString() ?? "lesson8";

        await ProcessSuccessfulPaymentAsync(studentId, courseId, externalId, amountCents / 100m, "USD", packageType, ct);
    }

    // WayForPay webhook handler
    public async Task HandleWayForPayWebhookAsync(string payload, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(payload);
        var transactionStatus = doc.RootElement.GetProperty("transactionStatus").GetString();

        if (transactionStatus != "Approved")
            return;

        var orderId = doc.RootElement.GetProperty("orderReference").GetString() ?? "";
        var amount = doc.RootElement.GetProperty("amount").GetDecimal();
        var currency = doc.RootElement.GetProperty("currency").GetString() ?? "UAH";

        // orderId format: "studentId_courseId_packageType_timestamp"
        var parts = orderId.Split('_');
        if (parts.Length < 3 || !Guid.TryParse(parts[0], out var studentId))
            return;

        Guid.TryParse(parts[1], out var courseId);
        var packageType = parts[2];

        await ProcessSuccessfulPaymentAsync(studentId, courseId, orderId, amount, currency, packageType, ct);
    }

    public async Task<bool> HasActiveAccessAsync(Guid studentId, Guid courseId, CancellationToken ct)
    {
        var enrollment = await db.CourseStudents
            .FirstOrDefaultAsync(cs => cs.StudentId == studentId && cs.CourseId == courseId, ct);

        if (enrollment == null) return false;

        if (enrollment.SubscriptionEndsAt.HasValue)
            return enrollment.SubscriptionEndsAt.Value > DateTimeOffset.UtcNow;

        return enrollment.BalanceLessons > 0;
    }

    private async Task ProcessSuccessfulPaymentAsync(
        Guid studentId, Guid courseId, string externalId,
        decimal amount, string currency, string packageType, CancellationToken ct)
    {
        if (await db.PaymentTransactions.AnyAsync(t => t.ExternalTxId == externalId, ct))
        {
            logger.LogWarning("Duplicate payment webhook ignored: {ExternalId}", externalId);
            return;
        }

        var tx = new PaymentTransaction
        {
            StudentId = studentId,
            CourseId = courseId == Guid.Empty ? null : courseId,
            Amount = amount,
            Currency = currency,
            Status = "Success",
            ExternalTxId = externalId
        };
        db.PaymentTransactions.Add(tx);

        // Skip enrollment update if no course is associated with this payment
        if (courseId == Guid.Empty)
        {
            await db.SaveChangesAsync(ct);
            return;
        }

        var enrollment = await db.CourseStudents
            .FirstOrDefaultAsync(cs => cs.StudentId == studentId && cs.CourseId == courseId, ct);

        if (enrollment == null)
        {
            enrollment = new CourseStudent { StudentId = studentId, CourseId = courseId };
            db.CourseStudents.Add(enrollment);
        }

        switch (packageType)
        {
            case "lesson8":
                enrollment.BalanceLessons += 8;
                break;
            case "lesson16":
                enrollment.BalanceLessons += 16;
                break;
            case "monthly":
                enrollment.SubscriptionEndsAt = DateTimeOffset.UtcNow.AddMonths(1);
                break;
            case "quarterly":
                enrollment.SubscriptionEndsAt = DateTimeOffset.UtcNow.AddMonths(3);
                break;
        }

        await db.SaveChangesAsync(ct);

        var student = await db.Users.FindAsync([studentId], ct);
        if (student?.TelegramId != null)
            await telegram.NotifyPaymentStatusAsync(studentId, "Success", amount, ct);
    }
}

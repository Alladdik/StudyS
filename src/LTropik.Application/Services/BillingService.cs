using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LTropik.Application.Services;

public class BillingService(
    IApplicationDbContext db,
    ITelegramNotificationService telegram,
    IConfiguration config,
    ILogger<BillingService> logger) : IBillingService
{
    // Stripe webhook handler
    public async Task HandleStripeWebhookAsync(string payload, string signature, CancellationToken ct)
    {
        if (!VerifyStripeSignature(payload, signature))
        {
            logger.LogWarning("Stripe webhook rejected: invalid or unverifiable signature");
            throw new UnauthorizedAccessException("Invalid Stripe signature");
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

        if (!VerifyWayForPaySignature(doc.RootElement))
        {
            logger.LogWarning("WayForPay webhook rejected: invalid or unverifiable signature");
            throw new UnauthorizedAccessException("Invalid WayForPay signature");
        }

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

    // ── Signature verification (fail closed) ─────────────────────────────────
    // Stripe sends "Stripe-Signature: t=<ts>,v1=<hex>[,v1=...]". The signed
    // payload is "<ts>.<rawBody>" hashed with HMAC-SHA256(webhook secret).
    private bool VerifyStripeSignature(string payload, string? sigHeader)
    {
        var secret = config["Stripe:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            logger.LogError("Stripe:WebhookSecret is not configured — rejecting Stripe webhook");
            return false;
        }
        if (string.IsNullOrWhiteSpace(sigHeader)) return false;

        string? t = null;
        var v1 = new List<string>();
        foreach (var part in sigHeader.Split(','))
        {
            var idx = part.IndexOf('=');
            if (idx <= 0) continue;
            var key = part[..idx].Trim();
            var val = part[(idx + 1)..].Trim();
            if (key == "t") t = val;
            else if (key == "v1") v1.Add(val);
        }
        if (t is null || v1.Count == 0) return false;

        // Replay protection: reject events older/newer than 5 minutes.
        if (long.TryParse(t, out var ts) &&
            Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts) > 300)
            return false;

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes($"{t}.{payload}"))).ToLowerInvariant();
        var expectedBytes = Encoding.UTF8.GetBytes(expected);

        return v1.Any(sig => CryptographicOperations.FixedTimeEquals(
            expectedBytes, Encoding.UTF8.GetBytes(sig.ToLowerInvariant())));
    }

    // WayForPay signs the fields below joined by ';' with HMAC-MD5(secret) and
    // sends it as "merchantSignature" inside the JSON body.
    private bool VerifyWayForPaySignature(JsonElement root)
    {
        var secret = config["WayForPay:MerchantSecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            logger.LogError("WayForPay:MerchantSecret is not configured — rejecting WayForPay webhook");
            return false;
        }
        if (!root.TryGetProperty("merchantSignature", out var sigEl)) return false;
        var provided = sigEl.GetString();
        if (string.IsNullOrWhiteSpace(provided)) return false;

        string[] fields = ["merchantAccount", "orderReference", "amount", "currency",
                           "authCode", "cardPan", "transactionStatus", "reasonCode"];
        var signString = string.Join(";", fields.Select(f => RawValue(root, f)));

        using var hmac = new HMACMD5(Encoding.UTF8.GetBytes(secret));
        var expected = Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes(signString))).ToLowerInvariant();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(provided.ToLowerInvariant()));
    }

    // Renders a JSON value the way WayForPay serialized it before signing:
    // numbers keep their raw on-the-wire representation, strings their text.
    private static string RawValue(JsonElement root, string prop)
    {
        if (!root.TryGetProperty(prop, out var el)) return "";
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString() ?? "",
            JsonValueKind.Null   => "",
            _                    => el.GetRawText(),
        };
    }
}

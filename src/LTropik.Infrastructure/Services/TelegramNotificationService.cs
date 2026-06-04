using LTropik.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;

namespace LTropik.Infrastructure.Services;

public class TelegramNotificationService(
    IApplicationDbContext db,
    IHttpClientFactory httpFactory,
    IAppSettingsService settings,
    ILogger<TelegramNotificationService> logger) : ITelegramNotificationService
{
    public async Task SendAsync(string telegramId, string message, CancellationToken ct = default)
    {
        var token = await settings.GetAsync("Telegram:BotToken", ct);
        if (string.IsNullOrWhiteSpace(token)) return;

        var client = httpFactory.CreateClient();
        var url = $"https://api.telegram.org/bot{token}/sendMessage";

        try
        {
            var response = await client.PostAsJsonAsync(url, new
            {
                chat_id = telegramId,
                text = message,
                parse_mode = "HTML"
            }, ct);

            if (!response.IsSuccessStatusCode)
                logger.LogWarning("Telegram send failed for chat {ChatId}: {Status}", telegramId, response.StatusCode);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Telegram notification failed for chat {ChatId}", telegramId);
        }
    }

    public async Task NotifyGradeChangedAsync(Guid studentId, string gradeName, string courseName, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([studentId], ct);
        if (user?.TelegramId == null) return;
        await SendAsync(user.TelegramId, $"📝 <b>Нова оцінка!</b>\nКурс: {courseName}\nОцінка: <b>{gradeName}</b>", ct);
    }

    public async Task NotifyHomeworkReviewReadyAsync(Guid teacherId, Guid submissionId, string studentName, CancellationToken ct)
    {
        var teacher = await db.Users.FindAsync([teacherId], ct);
        if (teacher?.TelegramId == null) return;
        await SendAsync(teacher.TelegramId, $"🤖 <b>AI-рецензія готова!</b>\nСтудент: {studentName}\nМожна перевіряти домашнє завдання.", ct);
    }

    public async Task NotifyPaymentStatusAsync(Guid studentId, string status, decimal amount, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([studentId], ct);
        if (user?.TelegramId == null) return;
        var emoji = status == "Success" ? "✅" : "❌";
        await SendAsync(user.TelegramId, $"{emoji} <b>Оплата {status}</b>\nСума: {amount:F2} грн", ct);
    }

    public async Task NotifyParentsAboutGradeAsync(Guid studentId, string gradeName, string courseName, CancellationToken ct)
    {
        var student = await db.Users.FindAsync([studentId], ct);
        if (student == null) return;

        var parents = await db.ParentStudents
            .Where(ps => ps.StudentId == studentId)
            .Include(ps => ps.Parent)
            .Select(ps => ps.Parent)
            .Where(p => p.TelegramId != null)
            .ToListAsync(ct);

        await Task.WhenAll(parents.Select(p =>
            SendAsync(p.TelegramId!, $"📝 <b>Нова оцінка у {student.FirstName} {student.LastName}</b>\nКурс: {courseName}\nОцінка: <b>{gradeName}</b>", ct)));
    }

    public Task Send2faCodeAsync(string telegramId, string code, CancellationToken ct) =>
        SendAsync(telegramId, $"🔐 <b>Код входу в LTropik</b>\n\n<code>{code}</code>\n\n⏱ Дійсний 5 хвилин. Нікому не повідомляйте.", ct);

    public async Task NotifyAbsenceAsync(Guid studentId, string courseName, string lessonDate, CancellationToken ct)
    {
        var student = await db.Users.FindAsync([studentId], ct);
        if (student == null) return;

        if (student.TelegramId != null)
            await SendAsync(student.TelegramId, $"⚠️ <b>Пропуск заняття</b>\nКурс: {courseName}\nДата: {lessonDate}\nЯкщо це помилка — зверніться до вчителя.", ct);

        var parents = await db.ParentStudents
            .Where(ps => ps.StudentId == studentId)
            .Include(ps => ps.Parent)
            .Select(ps => ps.Parent)
            .Where(p => p.TelegramId != null)
            .ToListAsync(ct);

        await Task.WhenAll(parents.Select(p =>
            SendAsync(p.TelegramId!, $"⚠️ <b>{student.FirstName} {student.LastName} пропустив(ла) заняття</b>\nКурс: {courseName}\nДата: {lessonDate}", ct)));
    }
}

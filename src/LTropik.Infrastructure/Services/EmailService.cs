using LTropik.Application.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace LTropik.Infrastructure.Services;

public class EmailService(IAppSettingsService settings) : IEmailService
{
    public async Task SendAsync(
        string toEmail,
        string subject,
        string htmlBody,
        IEnumerable<EmailAttachment>? attachments = null,
        CancellationToken ct = default)
    {
        var smtpHost = await settings.GetAsync("Email:SmtpHost", ct);
        if (string.IsNullOrEmpty(smtpHost)) return;

        var fromName    = await settings.GetAsync("Email:FromName", ct) ?? "LTropik";
        var fromAddress = await settings.GetAsync("Email:FromAddress", ct) ?? "noreply@ltropik.com";
        var smtpPortStr = await settings.GetAsync("Email:SmtpPort", ct) ?? "587";
        var username    = await settings.GetAsync("Email:Username", ct);
        var password    = await settings.GetAsync("Email:Password", ct);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;

        var builder = new BodyBuilder { HtmlBody = htmlBody };
        if (attachments != null)
        {
            foreach (var att in attachments)
                builder.Attachments.Add(att.FileName, att.Data, ContentType.Parse(att.ContentType));
        }
        message.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(smtpHost, int.Parse(smtpPortStr), SecureSocketOptions.StartTls, ct);

        if (!string.IsNullOrEmpty(username))
            await client.AuthenticateAsync(username, password, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}

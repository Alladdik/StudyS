using System.Threading.Channels;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

public record AuditLogEntry(Guid? UserId, string Action, string Details, string? IpAddress);

public sealed class AuditLogChannel
{
    private readonly Channel<AuditLogEntry> _channel = Channel.CreateUnbounded<AuditLogEntry>(
        new UnboundedChannelOptions { SingleReader = true });

    public ChannelWriter<AuditLogEntry> Writer => _channel.Writer;
    public ChannelReader<AuditLogEntry> Reader => _channel.Reader;
}

public class AuditLogWriter(
    AuditLogChannel channel,
    IServiceScopeFactory scopeFactory,
    ILogger<AuditLogWriter> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var entry in channel.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                db.AuditLogs.Add(new AuditLog
                {
                    UserId = entry.UserId,
                    Action = entry.Action,
                    Details = entry.Details,
                    IpAddress = entry.IpAddress
                });
                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "AuditLogWriter failed for action {Action}", entry.Action);
            }
        }
    }
}

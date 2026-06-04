using System.Text.Json;
using System.Threading.Channels;
using LTropik.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.BackgroundServices;

public record AiReviewJob(Guid SubmissionId, Guid TeacherId, string StudentName);

public sealed class AiReviewChannel
{
    private readonly Channel<AiReviewJob> _channel = Channel.CreateUnbounded<AiReviewJob>(
        new UnboundedChannelOptions { SingleReader = true });

    public ChannelWriter<AiReviewJob> Writer => _channel.Writer;
    public ChannelReader<AiReviewJob> Reader => _channel.Reader;
}

public class AiReviewWorker(
    AiReviewChannel channel,
    IServiceScopeFactory scopeFactory,
    ILogger<AiReviewWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in channel.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var ai = scope.ServiceProvider.GetRequiredService<IAiCoreService>();
                var telegram = scope.ServiceProvider.GetRequiredService<ITelegramNotificationService>();
                var notificationHub = scope.ServiceProvider.GetRequiredService<IReviewNotificationHub>();

                await ai.GenerateHomeworkReviewDraftAsync(job.SubmissionId, stoppingToken);

                await Task.WhenAll(
                    telegram.NotifyHomeworkReviewReadyAsync(job.TeacherId, job.SubmissionId, job.StudentName, stoppingToken),
                    notificationHub.NotifyReviewReadyAsync(job.TeacherId, job.SubmissionId)
                );

                logger.LogInformation("AI review completed for submission {SubmissionId}", job.SubmissionId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "AiReviewWorker failed for submission {SubmissionId}", job.SubmissionId);
            }
        }
    }
}

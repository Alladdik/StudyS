using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using LTropik.Infrastructure.BackgroundServices;
using LTropik.Infrastructure.Persistence;
using LTropik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace LTropik.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"))
                .UseSnakeCaseNamingConvention()); // maps Role→role, FirstName→first_name, etc.

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        // Redis — optional: if not available app still works (2FA, caching disabled)
        var redisConn = config.GetConnectionString("Redis") ?? "localhost:6379";
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var opts = ConfigurationOptions.Parse(redisConn);
            opts.AbortOnConnectFail = false;          // don't crash if Redis is down
            opts.ConnectTimeout     = 2000;
            opts.SyncTimeout        = 1000;
            opts.ReconnectRetryPolicy = new ExponentialRetry(1000);
            return ConnectionMultiplexer.Connect(opts);
        });
        services.AddScoped<ICacheService, RedisCacheService>();

        services.AddHttpClient("openai", c =>
        {
            c.BaseAddress = new Uri("https://api.openai.com");
        });

        services.AddScoped<IAppSettingsService, AppSettingsService>();
        services.AddScoped<IAiCoreService, AiCoreService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<ITestEngineService, TestEngineService>();
        services.AddScoped<ITelegramNotificationService, TelegramNotificationService>();
        services.AddScoped<IGamificationService, GamificationService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<ITelegramBotService, TelegramBotService>();
        services.AddSingleton<IRoomPresenceService, RoomPresenceService>();
        services.AddScoped<AuthService>();

        // Background services with channels
        services.AddSingleton<AiReviewChannel>();
        services.AddSingleton<AuditLogChannel>();
        services.AddHostedService<AiReviewWorker>();
        services.AddHostedService<AuditLogWriter>();
        services.AddHostedService<DailyQuestResetWorker>();
        services.AddHostedService<HomeworkReminderWorker>();
        services.AddHostedService<LessonReminderWorker>();
        services.AddHostedService<StreakReminderWorker>();
        services.AddHostedService<WeeklyLeaderboardWorker>();

        return services;
    }
}

using System.Text;
using System.Threading.RateLimiting;
using LTropik.Application.Interfaces;
using LTropik.Infrastructure;
using Microsoft.EntityFrameworkCore;
using LTropik.WebAPI;
using LTropik.WebAPI.Filters;
using LTropik.WebAPI.Hubs;
using LTropik.WebAPI.Controllers;
using LTropik.WebAPI.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(opts =>
{
    opts.Filters.Add<AuditFilter>();
});

builder.Services.AddSignalR();
builder.Services.AddScoped<IReviewNotificationHub, ReviewNotificationHub>();
builder.Services.AddScoped<INotificationHub, NotificationHubProxy>();

// JWT Auth
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new Exception("Jwt:Key is not configured");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        // Allow JWT in SignalR query string
        opts.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddInfrastructure(builder.Configuration);

// Rate limiting — throttles brute-force on auth endpoints (login/register/etc.).
// Keyed per client IP so one attacker can't lock everyone out.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

builder.Services.AddCors(opts =>
    opts.AddPolicy("frontend", p => p
        .WithOrigins(builder.Configuration["Frontend:Url"] ?? "http://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "LTropik API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {token}",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    });
});

var app = builder.Build();

// ── Auto-migrate database on startup ─────────────────────────────────────────
// Applies any pending EF Core migrations automatically.
// Safe to run on every startup — skips if already up to date.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LTropik.Infrastructure.Persistence.AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
        app.Logger.LogInformation("✅ Database migrations applied successfully");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "❌ Failed to apply database migrations");
        throw; // Fail fast — don't run with broken schema
    }
}

// Catch-all exception → JSON mapper. Must be first so it wraps the whole pipeline.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseCors("frontend");
app.UseSwagger();
app.UseSwaggerUI();
app.UseStaticFiles();

app.UseAuthentication();
app.UseMiddleware<AccessControlMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHub<ReviewHub>("/hubs/review");
app.MapHub<RoomHub>("/hubs/room");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<CivHub>("/hubs/civ");

// Auto-seed DB + create admin on first run
await DbSeeder.InitAsync(app.Services, app.Logger);

app.Run();

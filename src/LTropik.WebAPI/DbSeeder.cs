using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI;

public static class DbSeeder
{
    public static async Task InitAsync(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;

        try
        {
            var ctx = sp.GetRequiredService<LTropik.Infrastructure.Persistence.AppDbContext>();
            await ctx.Database.EnsureCreatedAsync();

            // Column patches (idempotent)
            await RunSql(ctx, "ALTER TABLE users           ADD COLUMN IF NOT EXISTS telegram_id        VARCHAR(64)");
            await RunSql(ctx, "ALTER TABLE users           ADD COLUMN IF NOT EXISTS telegram_link_code  VARCHAR(16)");
            await RunSql(ctx, "ALTER TABLE tests           ADD COLUMN IF NOT EXISTS allowed_student_ids TEXT DEFAULT ''");
            await RunSql(ctx, "ALTER TABLE test_attempts   ADD COLUMN IF NOT EXISTS answers_json        JSONB");
            await RunSql(ctx, "ALTER TABLE homeworks       ADD COLUMN IF NOT EXISTS due_date            TIMESTAMPTZ");
            await RunSql(ctx, "ALTER TABLE homeworks       ADD COLUMN IF NOT EXISTS reminder_sent       BOOLEAN NOT NULL DEFAULT FALSE");
            await RunSql(ctx, "ALTER TABLE student_streaks ADD COLUMN IF NOT EXISTS total_xp            INT NOT NULL DEFAULT 0");
            await RunSql(ctx, "ALTER TABLE rooms           ADD COLUMN IF NOT EXISTS room_type           VARCHAR(32) NOT NULL DEFAULT 'video'");
            await RunSql(ctx, "ALTER TABLE users           ADD COLUMN IF NOT EXISTS is_email_verified    BOOLEAN NOT NULL DEFAULT TRUE");
            await RunSql(ctx, "ALTER TABLE users           ADD COLUMN IF NOT EXISTS email_verify_token   VARCHAR(128)");

            // New tables
            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS enrollment_requests (
                id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id     UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                student_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
                status        VARCHAR(32) NOT NULL DEFAULT 'Pending',
                message       TEXT,
                response_note TEXT,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_at   TIMESTAMPTZ
            )");
            await RunSql(ctx, "CREATE INDEX IF NOT EXISTS ix_enrollment_requests_course_student ON enrollment_requests(course_id, student_id)");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS shop_items (
                id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                name            TEXT        NOT NULL,
                description     TEXT        NOT NULL DEFAULT '',
                icon            VARCHAR(8)  NOT NULL DEFAULT '🎁',
                type            VARCHAR(32) NOT NULL DEFAULT 'custom',
                coins_price     INT         NOT NULL DEFAULT 0,
                is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
                max_per_student INT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS shop_purchases (
                id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id        UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
                item_id           UUID        NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
                context_course_id UUID,
                purchased_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                used_at           TIMESTAMPTZ
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS daily_quests (
                id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                type         VARCHAR(64) NOT NULL,
                title        TEXT        NOT NULL,
                description  TEXT        NOT NULL DEFAULT '',
                icon         VARCHAR(8)  NOT NULL DEFAULT '⭐',
                coins_reward INT         NOT NULL DEFAULT 10,
                is_active    BOOLEAN     NOT NULL DEFAULT TRUE
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS student_daily_quests (
                id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id   UUID  NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
                quest_id     UUID  NOT NULL REFERENCES daily_quests(id) ON DELETE CASCADE,
                date         DATE  NOT NULL,
                completed_at TIMESTAMPTZ
            )");
            await RunSql(ctx, "CREATE UNIQUE INDEX IF NOT EXISTS ix_student_daily_quests_unique ON student_daily_quests(student_id, quest_id, date)");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS course_reviews (
                id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id  UUID     NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                student_id UUID     NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
                rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comment    TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )");
            await RunSql(ctx, "CREATE UNIQUE INDEX IF NOT EXISTS ix_course_reviews_unique ON course_reviews(course_id, student_id)");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS direct_messages (
                id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
                sender_id   UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                receiver_id UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                content     TEXT    NOT NULL,
                sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                is_read     BOOLEAN NOT NULL DEFAULT FALSE
            )");
            await RunSql(ctx, "CREATE INDEX IF NOT EXISTS ix_direct_messages_conv ON direct_messages(sender_id, receiver_id)");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS message_reactions (
                id                UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
                direct_message_id UUID       REFERENCES direct_messages(id) ON DELETE CASCADE,
                room_message_id   UUID       REFERENCES room_messages(id)   ON DELETE CASCADE,
                user_id           UUID       NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
                emoji             VARCHAR(8) NOT NULL DEFAULT '👍'
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS lesson_recordings (
                id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
                lesson_id       UUID   NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                teacher_id      UUID   NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
                file_url        TEXT   NOT NULL,
                title           TEXT,
                file_size_bytes BIGINT NOT NULL DEFAULT 0,
                recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS app_settings (
                key       VARCHAR(128) PRIMARY KEY,
                value     TEXT,
                is_secret BOOLEAN NOT NULL DEFAULT FALSE
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS lesson_notes (
                id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
                lesson_id  UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                content    TEXT        NOT NULL DEFAULT '',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(student_id, lesson_id)
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS bookmarks (
                id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type       VARCHAR(32) NOT NULL DEFAULT 'lesson',
                ref_id     UUID        NOT NULL,
                title      TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, type, ref_id)
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS flashcard_sets (
                id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                lesson_id  UUID        REFERENCES lessons(id) ON DELETE SET NULL,
                title      TEXT        NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS flashcards (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                set_id     UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
                front      TEXT NOT NULL,
                back       TEXT NOT NULL,
                sort_order INT  NOT NULL DEFAULT 0
            )");

            await RunSql(ctx, @"CREATE TABLE IF NOT EXISTS push_subscriptions (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint   TEXT NOT NULL,
                p256dh     TEXT NOT NULL,
                auth       TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )");

            logger.LogInformation("Schema up-to-date");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Schema init failed: {Msg}", ex.Message);
        }

        // wwwroot/uploads
        var env = sp.GetRequiredService<IWebHostEnvironment>();
        Directory.CreateDirectory(Path.Combine(env.WebRootPath ?? "wwwroot", "uploads"));

        // First-run admin — credentials from env vars or appsettings, never hardcoded
        var db     = sp.GetRequiredService<IApplicationDbContext>();
        var auth   = sp.GetRequiredService<AuthService>();
        var config = sp.GetRequiredService<IConfiguration>();

        var adminEmail    = config["Seed:AdminEmail"]     ?? "admin@ltropik.com";
        var adminPassword = config["Seed:AdminPassword"]  ?? GeneratePassword();
        var adminFirst    = config["Seed:AdminFirstName"] ?? "Admin";
        var adminLast     = config["Seed:AdminLastName"]  ?? "LTropik";

        if (!await db.Users.AnyAsync(u => u.Email == adminEmail))
        {
            await auth.RegisterAsync(
                new RegisterRequest(adminEmail, adminPassword, adminFirst, adminLast, "Admin"),
                CancellationToken.None);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n╔══════════════════════════════════════════╗");
            Console.WriteLine("║  Перший запуск — Admin акаунт створено  ║");
            Console.WriteLine($"║  Email:  {adminEmail,-32}║");
            Console.WriteLine($"║  Пароль: {adminPassword,-32}║");
            Console.WriteLine("╚══════════════════════════════════════════╝");
            Console.ResetColor();
            Console.WriteLine("  ⚠️  Збережіть ці дані та змініть пароль у профілі!\n");
        }
    }

    private static async Task RunSql(LTropik.Infrastructure.Persistence.AppDbContext ctx, string sql)
    {
        try { await ctx.Database.ExecuteSqlRawAsync(sql); }
        catch (Exception ex) when (ex.Message.Contains("вже існує") || ex.Message.Contains("already exists")) { }
    }

    private static string GeneratePassword()
    {
        const string chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
        var rng = new Random(Environment.TickCount);
        return new string(Enumerable.Range(0, 16).Select(_ => chars[rng.Next(chars.Length)]).ToArray());
    }
}

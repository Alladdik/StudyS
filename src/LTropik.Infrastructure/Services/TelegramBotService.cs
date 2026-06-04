using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using LTropik.Application.Interfaces;
using LTropik.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.Services;

public class TelegramBotService(
    IApplicationDbContext db,
    IHttpClientFactory httpFactory,
    IAppSettingsService settings,
    ICacheService cache,
    ILogger<TelegramBotService> logger) : ITelegramBotService
{
    public async Task HandleUpdateAsync(JsonElement update, CancellationToken ct = default)
    {
        if (!update.TryGetProperty("message", out var msg)) return;
        if (!msg.TryGetProperty("text", out var textEl)) return;

        var text   = textEl.GetString()?.Trim() ?? "";
        var chatId = msg.GetProperty("chat").GetProperty("id").GetInt64().ToString();
        var fromEl = msg.TryGetProperty("from", out var f) ? f : default;
        var tgName = fromEl.ValueKind != JsonValueKind.Undefined && fromEl.TryGetProperty("first_name", out var fn)
                     ? fn.GetString() ?? "" : "";

        try
        {
            if (text.StartsWith("/start"))        await HandleStartAsync(chatId, tgName, ct);
            else if (text.StartsWith("/link"))     await HandleLinkAsync(chatId, text, ct);
            else if (text.StartsWith("/schedule")) await HandleScheduleAsync(chatId, ct);
            else if (text.StartsWith("/grades"))   await HandleGradesAsync(chatId, ct);
            else if (text.StartsWith("/homework")) await HandleHomeworkAsync(chatId, ct);
            else if (text.StartsWith("/children")) await HandleChildrenAsync(chatId, ct);
            else if (text.StartsWith("/report"))   await HandleReportAsync(chatId, ct);
            else if (text.StartsWith("/attendance")) await HandleAttendanceAsync(chatId, ct);
            else if (System.Text.RegularExpressions.Regex.IsMatch(text.Trim(), @"^\d{6}$"))
                await Handle2faCodeAsync(chatId, text.Trim(), ct);
            else
                await SendHelpAsync(chatId, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Bot error processing update from chatId {ChatId}", chatId);
        }
    }

    private async Task Handle2faCodeAsync(string chatId, string code, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) return;

        var storedCode = await cache.GetAsync<string>($"2fa_user:{user.Id}", ct);
        if (storedCode == code)
        {
            await cache.RemoveAsync($"2fa_user:{user.Id}", ct);
            await SendAsync(chatId, "✅ Код підтверджено! Повертайтесь на сайт — вхід виконано.", ct);
        }
    }

    private Task HandleStartAsync(string chatId, string name, CancellationToken ct) =>
        SendAsync(chatId, $"""
            Привіт, {name}! 👋 Я бот <b>LTropik</b> — школи нового покоління.

            Щоб підключити свій акаунт:
            1️⃣ Відкрийте сайт → Профіль → натисніть <b>«Отримати код»</b>
            2️⃣ Надішліть мені команду: <code>/link ВАШ_КОД</code>

            Доступні команди після підключення:
            /schedule — розклад на сьогодні та завтра
            /grades — останні оцінки
            /homework — невиконані домашні завдання
            /attendance — статистика відвідуваності
            /report — повний звіт по успішності
            /children — ваші діти та їх прогрес (для батьків)
            /help — ця підказка
            """, ct);

    private async Task HandleLinkAsync(string chatId, string text, CancellationToken ct)
    {
        var parts = text.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2)
        {
            await SendAsync(chatId, "⚠️ Вкажіть код. Наприклад: <code>/link ABC123</code>", ct);
            return;
        }

        var code = parts[1].Trim().ToUpperInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.TelegramLinkCode == code, ct);

        if (user == null)
        {
            await SendAsync(chatId, "❌ Код не знайдено або він вже застарів. Отримайте новий на сайті.", ct);
            return;
        }

        var existing = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == chatId && u.Id != user.Id, ct);
        if (existing != null) existing.TelegramId = null;

        user.TelegramId = chatId;
        user.TelegramLinkCode = null;
        await db.SaveChangesAsync(ct);

        await SendAsync(chatId, $"""
            ✅ <b>Акаунт підключено!</b>
            Ім'я: {user.FirstName} {user.LastName}
            Роль: {RoleName(user.Role)}

            Тепер доступні команди /schedule, /grades, /homework
            """, ct);
    }

    private async Task HandleScheduleAsync(string chatId, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) { await SendNotLinkedAsync(chatId, ct); return; }

        var today    = DateTimeOffset.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        IQueryable<Guid> studentIds = user.Role == UserRole.Parent
            ? db.ParentStudents.Where(ps => ps.ParentId == user.Id).Select(ps => ps.StudentId)
            : db.Users.Where(u => u.Id == user.Id).Select(u => u.Id);

        var schedules = await db.Schedules
            .Include(s => s.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Include(s => s.Teacher)
            .Where(s =>
                s.Lesson.Module.Course.Students.Any(cs => studentIds.Contains(cs.StudentId)) &&
                s.StartsAt.Date >= today && s.StartsAt.Date <= tomorrow)
            .OrderBy(s => s.StartsAt)
            .Select(s => new { s.StartsAt, LessonTitle = s.Lesson.Title, CourseTitle = s.Lesson.Module.Course.Title, TeacherName = s.Teacher.FirstName + " " + s.Teacher.LastName })
            .ToListAsync(ct);

        if (schedules.Count == 0) { await SendAsync(chatId, "📅 Найближчих занять немає.", ct); return; }

        var sb = new StringBuilder();
        DateTimeOffset? lastDay = null;
        foreach (var s in schedules)
        {
            if (lastDay?.Date != s.StartsAt.Date)
            {
                lastDay = s.StartsAt;
                var label = s.StartsAt.Date == today ? "сьогодні" : "завтра";
                sb.AppendLine($"\n📅 <b>Розклад на {label} ({s.StartsAt:dd.MM}):</b>");
            }
            sb.AppendLine($"  {s.StartsAt:HH:mm} — <b>{s.CourseTitle}</b>");
            sb.AppendLine($"    📖 {s.LessonTitle}  |  👤 {s.TeacherName}");
        }

        await SendAsync(chatId, sb.ToString().Trim(), ct);
    }

    private async Task HandleGradesAsync(string chatId, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) { await SendNotLinkedAsync(chatId, ct); return; }

        IQueryable<Guid> studentIds = user.Role == UserRole.Parent
            ? db.ParentStudents.Where(ps => ps.ParentId == user.Id).Select(ps => ps.StudentId)
            : db.Users.Where(u => u.Id == user.Id).Select(u => u.Id);

        var grades = await db.AttendanceAndGrades
            .Include(a => a.Grade)
            .Include(a => a.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Include(a => a.Student)
            .Where(a => studentIds.Contains(a.StudentId) && a.GradeId != null)
            .OrderByDescending(a => a.LessonDate)
            .Take(7)
            .Select(a => new { StudentName = a.Student.FirstName + " " + a.Student.LastName, CourseTitle = a.Lesson.Module.Course.Title, Grade = a.Grade!.ValueString, a.LessonDate })
            .ToListAsync(ct);

        if (grades.Count == 0) { await SendAsync(chatId, "📝 Оцінок ще немає.", ct); return; }

        var sb = new StringBuilder("📝 <b>Останні оцінки:</b>\n\n");
        foreach (var g in grades)
        {
            var who = user.Role == UserRole.Parent ? $"[{g.StudentName}] " : "";
            sb.AppendLine($"• {who}<b>{g.CourseTitle}</b> — {g.Grade} ({g.LessonDate:dd.MM.yyyy})");
        }

        await SendAsync(chatId, sb.ToString().Trim(), ct);
    }

    private async Task HandleHomeworkAsync(string chatId, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) { await SendNotLinkedAsync(chatId, ct); return; }

        IQueryable<Guid> studentIds = user.Role == UserRole.Parent
            ? db.ParentStudents.Where(ps => ps.ParentId == user.Id).Select(ps => ps.StudentId)
            : db.Users.Where(u => u.Id == user.Id).Select(u => u.Id);

        var pending = await db.Homeworks
            .Include(h => h.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Where(h =>
                h.Lesson.Module.Course.Students.Any(cs => studentIds.Contains(cs.StudentId)) &&
                !h.Submissions.Any(s => studentIds.Contains(s.StudentId) &&
                    (s.Status == HomeworkStatus.OnReview || s.Status == HomeworkStatus.Passed)))
            .Select(h => new { CourseTitle = h.Lesson.Module.Course.Title, LessonTitle = h.Lesson.Title, Instruction = h.Instruction.Length > 80 ? h.Instruction.Substring(0, 80) + "…" : h.Instruction })
            .Take(10)
            .ToListAsync(ct);

        if (pending.Count == 0) { await SendAsync(chatId, "✅ Всі домашні завдання виконано! Чудова робота!", ct); return; }

        var sb = new StringBuilder($"📚 <b>Незавершені домашні завдання ({pending.Count}):</b>\n\n");
        foreach (var hw in pending)
            sb.AppendLine($"• <b>{hw.CourseTitle}</b> — {hw.LessonTitle}\n  {hw.Instruction}");

        await SendAsync(chatId, sb.ToString().Trim(), ct);
    }

    private async Task HandleChildrenAsync(string chatId, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) { await SendNotLinkedAsync(chatId, ct); return; }

        if (user.Role != UserRole.Parent)
        {
            await SendAsync(chatId, "ℹ️ Ця команда доступна лише для батьків.", ct);
            return;
        }

        var links = await db.ParentStudents
            .Where(ps => ps.ParentId == user.Id)
            .Include(ps => ps.Student)
            .ToListAsync(ct);

        if (links.Count == 0) { await SendAsync(chatId, "ℹ️ До вашого акаунту не прив'язано жодного учня.", ct); return; }

        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(now.Year, now.Month, 1);

        var sb = new StringBuilder("👨‍👩‍👧 <b>Ваші діти:</b>\n\n");
        foreach (var link in links)
        {
            var child = link.Student;
            var monthGrades = await db.AttendanceAndGrades
                .Where(a => a.StudentId == child.Id && a.LessonDate >= monthStart && a.GradeId != null)
                .Include(a => a.Grade)
                .ToListAsync(ct);

            var pendingHw = await db.Homeworks
                .CountAsync(h => h.Lesson.Module.Course.Students.Any(cs => cs.StudentId == child.Id) &&
                    !h.Submissions.Any(s => s.StudentId == child.Id &&
                        (s.Status == HomeworkStatus.OnReview || s.Status == HomeworkStatus.Passed)), ct);

            var presentCount = await db.AttendanceAndGrades
                .CountAsync(a => a.StudentId == child.Id && a.LessonDate >= monthStart &&
                    (a.Attendance == AttendanceStatus.Present || a.Attendance == AttendanceStatus.Late), ct);
            var totalCount = await db.AttendanceAndGrades
                .CountAsync(a => a.StudentId == child.Id && a.LessonDate >= monthStart, ct);

            sb.AppendLine($"👤 <b>{child.FirstName} {child.LastName}</b>");
            sb.AppendLine($"  📊 Відвідуваність цього місяця: {(totalCount > 0 ? $"{presentCount}/{totalCount}" : "немає занять")}");
            sb.AppendLine($"  📝 Оцінок цього місяця: {monthGrades.Count}");
            sb.AppendLine($"  📚 Невиконаних ДЗ: {pendingHw}");
            sb.AppendLine();
        }
        sb.AppendLine("Детальніший звіт: /report");
        await SendAsync(chatId, sb.ToString().Trim(), ct);
    }

    private async Task HandleReportAsync(string chatId, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) { await SendNotLinkedAsync(chatId, ct); return; }

        IQueryable<Guid> studentIds = user.Role == UserRole.Parent
            ? db.ParentStudents.Where(ps => ps.ParentId == user.Id).Select(ps => ps.StudentId)
            : db.Users.Where(u => u.Id == user.Id).Select(u => u.Id);

        var students = await db.Users
            .Where(u => studentIds.Contains(u.Id))
            .ToListAsync(ct);

        if (students.Count == 0)
        {
            await SendAsync(chatId, user.Role == UserRole.Parent
                ? "ℹ️ До вашого акаунту не прив'язано жодного учня."
                : "ℹ️ Дані відсутні.", ct);
            return;
        }

        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(now.Year, now.Month, 1);
        var sb = new StringBuilder($"📋 <b>Звіт за {now:MMMM yyyy}</b>\n\n");

        foreach (var student in students)
        {
            var allRecords = await db.AttendanceAndGrades
                .Include(a => a.Grade)
                .Include(a => a.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
                .Where(a => a.StudentId == student.Id && a.LessonDate >= monthStart)
                .ToListAsync(ct);

            var totalLessons  = allRecords.Count;
            var presentCount  = allRecords.Count(a => a.Attendance == AttendanceStatus.Present || a.Attendance == AttendanceStatus.Late);
            var absentCount   = allRecords.Count(a => a.Attendance == AttendanceStatus.AbsentWithoutReason);
            var attendancePct = totalLessons > 0 ? (int)Math.Round(presentCount * 100.0 / totalLessons) : 0;

            var graded = allRecords.Where(a => a.GradeId != null && a.Grade != null).ToList();
            var gradedPassing = graded.Count(a => a.Grade!.IsPassing);

            var pendingHw = await db.Homeworks
                .CountAsync(h => h.Lesson.Module.Course.Students.Any(cs => cs.StudentId == student.Id) &&
                    !h.Submissions.Any(s => s.StudentId == student.Id &&
                        (s.Status == HomeworkStatus.OnReview || s.Status == HomeworkStatus.Passed)), ct);

            var nextLesson = await db.Schedules
                .Include(s => s.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
                .Where(s => s.Lesson.Module.Course.Students.Any(cs => cs.StudentId == student.Id) &&
                    s.StartsAt >= DateTime.UtcNow)
                .OrderBy(s => s.StartsAt)
                .Select(s => new { s.StartsAt, CourseTitle = s.Lesson.Module.Course.Title })
                .FirstOrDefaultAsync(ct);

            var attendEmoji = attendancePct >= 80 ? "✅" : attendancePct >= 60 ? "⚠️" : "❌";

            if (user.Role == UserRole.Parent)
                sb.AppendLine($"👤 <b>{student.FirstName} {student.LastName}</b>");

            sb.AppendLine($"  {attendEmoji} Відвідуваність: {attendancePct}% ({presentCount}/{totalLessons})");
            if (absentCount > 0) sb.AppendLine($"  ⛔ Пропусків б/п: {absentCount}");
            sb.AppendLine($"  📝 Оцінок: {graded.Count} ({gradedPassing} зарахованих)");
            sb.AppendLine($"  📚 Незавершених ДЗ: {pendingHw}");

            if (nextLesson != null)
                sb.AppendLine($"  📅 Наступне заняття: {nextLesson.StartsAt:dd.MM HH:mm} — {nextLesson.CourseTitle}");

            if (graded.Count > 0)
            {
                var recent = allRecords
                    .Where(a => a.GradeId != null)
                    .OrderByDescending(a => a.LessonDate)
                    .Take(3)
                    .Select(a => $"{a.Grade!.ValueString} ({a.Lesson.Module.Course.Title})")
                    .ToList();
                sb.AppendLine($"  🏅 Останні оцінки: {string.Join(", ", recent)}");
            }

            sb.AppendLine();
        }

        await SendAsync(chatId, sb.ToString().Trim(), ct);
    }

    private async Task HandleAttendanceAsync(string chatId, CancellationToken ct)
    {
        var user = await FindUserAsync(chatId, ct);
        if (user == null) { await SendNotLinkedAsync(chatId, ct); return; }

        IQueryable<Guid> studentIds = user.Role == UserRole.Parent
            ? db.ParentStudents.Where(ps => ps.ParentId == user.Id).Select(ps => ps.StudentId)
            : db.Users.Where(u => u.Id == user.Id).Select(u => u.Id);

        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(now.Year, now.Month, 1);

        var records = await db.AttendanceAndGrades
            .Include(a => a.Student)
            .Include(a => a.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .Where(a => studentIds.Contains(a.StudentId) && a.LessonDate >= monthStart)
            .ToListAsync(ct);

        if (records.Count == 0) { await SendAsync(chatId, "📊 Занять цього місяця ще не було.", ct); return; }

        var sb = new StringBuilder($"📊 <b>Відвідуваність за {now:MMMM yyyy}</b>\n\n");

        var byStudent = records.GroupBy(a => new { a.StudentId, a.Student.FirstName, a.Student.LastName });
        foreach (var group in byStudent)
        {
            var total   = group.Count();
            var present = group.Count(a => a.Attendance == AttendanceStatus.Present || a.Attendance == AttendanceStatus.Late);
            var late    = group.Count(a => a.Attendance == AttendanceStatus.Late);
            var absBp   = group.Count(a => a.Attendance == AttendanceStatus.AbsentWithoutReason);
            var absWr   = group.Count(a => a.Attendance == AttendanceStatus.AbsentWithReason);
            var pct     = (int)Math.Round(present * 100.0 / total);
            var emoji   = pct >= 80 ? "🟢" : pct >= 60 ? "🟡" : "🔴";

            if (user.Role == UserRole.Parent)
                sb.AppendLine($"👤 <b>{group.Key.FirstName} {group.Key.LastName}</b>");

            sb.AppendLine($"  {emoji} Загалом: {pct}% ({present}/{total})");
            if (late  > 0) sb.AppendLine($"  ⏰ Запізнень: {late}");
            if (absBp > 0) sb.AppendLine($"  ⛔ Пропусків б/п: {absBp}");
            if (absWr > 0) sb.AppendLine($"  📋 Поважна причина: {absWr}");

            var byCourse = group.GroupBy(a => a.Lesson.Module.Course.Title);
            foreach (var course in byCourse)
            {
                var cp = course.Count(a => a.Attendance == AttendanceStatus.Present || a.Attendance == AttendanceStatus.Late);
                sb.AppendLine($"    • {course.Key}: {cp}/{course.Count()}");
            }
            sb.AppendLine();
        }

        await SendAsync(chatId, sb.ToString().Trim(), ct);
    }

    private Task<Domain.Entities.User?> FindUserAsync(string chatId, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.TelegramId == chatId, ct);

    private Task SendNotLinkedAsync(string chatId, CancellationToken ct) =>
        SendAsync(chatId, "🔗 Спочатку підключіть акаунт.\n1️⃣ Відкрийте сайт → Профіль\n2️⃣ Натисніть «Отримати код» та надішліть мені /link КОД", ct);

    private Task SendHelpAsync(string chatId, CancellationToken ct) =>
        SendAsync(chatId, """
            📋 <b>Доступні команди:</b>

            /link КОД — підключити акаунт
            /schedule — розклад на сьогодні та завтра
            /grades — останні оцінки
            /homework — невиконані ДЗ
            /attendance — статистика відвідуваності за місяць
            /report — повний звіт по успішності
            /children — діти та їх прогрес (для батьків)
            """, ct);

    public async Task SendAsync(string chatId, string text, CancellationToken ct)
    {
        var token = await settings.GetAsync("Telegram:BotToken", ct);
        if (string.IsNullOrWhiteSpace(token)) return;
        var client = httpFactory.CreateClient();
        await client.PostAsJsonAsync(
            $"https://api.telegram.org/bot{token}/sendMessage",
            new { chat_id = chatId, text, parse_mode = "HTML" },
            ct);
    }

    private static string RoleName(UserRole role) => role switch
    {
        UserRole.Student  => "Студент",
        UserRole.Teacher  => "Викладач",
        UserRole.Parent   => "Батьки",
        UserRole.Admin    => "Адміністратор",
        UserRole.Manager  => "Менеджер",
        _ => role.ToString()
    };
}

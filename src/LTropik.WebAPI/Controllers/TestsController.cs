using System.Security.Claims;
using System.Text.Json;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TestsController(
    IApplicationDbContext db,
    ITestEngineService engine,
    IAiCoreService ai) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var test = await db.Tests.FindAsync([id], ct);
        if (test == null) return NotFound();

        var questions = JsonSerializer.Deserialize<List<StoredQuestion>>(
            test.Questions.RootElement.GetRawText()) ?? [];

        return Ok(new TestInfoDto(
            test.Id, test.Title, test.TimeLimitMinutes, test.MaxAttempts, test.PassingPercentage,
            questions.Select(q => new TestQuestionPublicDto(
                q.Id, q.Type, q.Text,
                q.Options?.Select(o => new TestOptionDto(o.Id, o.Text)).ToList()
            )).ToList()
        ));
    }

    [HttpGet("{id:guid}/remaining-attempts")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetRemainingAttempts(Guid id, CancellationToken ct)
    {
        var remaining = await engine.GetRemainingAttemptsAsync(id, CurrentUserId, ct);
        return Ok(remaining);
    }

    [HttpGet("{id:guid}/start")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var remaining = await engine.GetRemainingAttemptsAsync(id, CurrentUserId, ct);
        if (remaining <= 0)
            return BadRequest(new { error = "Вичерпано кількість спроб" });

        var test = await db.Tests.FindAsync([id], ct);
        if (test == null) return NotFound();

        // Record attempt start on server
        var attempt = new TestAttempt
        {
            TestId = id,
            StudentId = CurrentUserId,
            StartedAt = DateTimeOffset.UtcNow,
            ScorePercentage = 0,
            Passed = false
        };
        db.TestAttempts.Add(attempt);
        await db.SaveChangesAsync(ct);

        return Ok(new StartTestResponse(attempt.Id, attempt.StartedAt, test.TimeLimitMinutes));
    }

    [HttpPost("submit")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Submit(SubmitAnswersRequest req, CancellationToken ct)
    {
        var attempt = await db.TestAttempts.FindAsync([req.AttemptId], ct);
        if (attempt == null || attempt.StudentId != CurrentUserId)
            return Forbid();

        var result = await engine.SubmitAsync(
            new SubmitTestRequest(attempt.TestId, CurrentUserId, req.Answers), ct);

        // Record granular details
        var detailsPayload = new
        {
            answers = req.Answers,
            questionTimes = req.QuestionTimes ?? new Dictionary<string, int>()
        };
        attempt.AnswersJson = JsonDocument.Parse(JsonSerializer.Serialize(detailsPayload));
        await db.SaveChangesAsync(ct);

        return Ok(result);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var tests = await db.Tests
            .Include(t => t.Lesson).ThenInclude(l => l.Module).ThenInclude(m => m.Course)
            .OrderBy(t => t.Title)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.TimeLimitMinutes,
                t.MaxAttempts,
                t.PassingPercentage,
                t.LessonId,
                LessonTitle = t.Lesson.Title,
                CourseTitle = t.Lesson.Module.Course.Title,
                t.AllowedStudentIds,
                QuestionsCount = t.Questions != null ? t.Questions.RootElement.GetArrayLength() : 0
            })
            .ToListAsync(ct);
        return Ok(tests);
    }

    [HttpGet("{id:guid}/attempts")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GetAttempts(Guid id, CancellationToken ct)
    {
        var raw = await db.TestAttempts
            .Include(a => a.Student)
            .Where(a => a.TestId == id && a.FinishedAt != null)
            .OrderByDescending(a => a.StartedAt)
            .Select(a => new
            {
                a.Id,
                a.StudentId,
                StudentName  = a.Student.FirstName + " " + a.Student.LastName,
                StudentEmail = a.Student.Email,
                a.ScorePercentage,
                a.Passed,
                a.StartedAt,
                a.FinishedAt,
                RawAnswers = a.AnswersJson != null ? a.AnswersJson.RootElement.GetRawText() : null
            })
            .ToListAsync(ct);

        var attempts = raw.Select(a => new
        {
            a.Id,
            a.StudentId,
            a.StudentName,
            a.StudentEmail,
            a.ScorePercentage,
            a.Passed,
            a.StartedAt,
            a.FinishedAt,
            AnswersJson = a.RawAnswers != null
                ? JsonSerializer.Deserialize<object>(a.RawAnswers)
                : null
        });
        return Ok(attempts);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Create([FromQuery] Guid lessonId, [FromQuery] string? allowedStudentIds, CreateTestRequest req, CancellationToken ct)
    {
        // Teachers can only create tests for their own course lessons
        if (User.IsInRole("Teacher"))
        {
            var lesson = await db.Lessons
                .Include(l => l.Module)
                .FirstOrDefaultAsync(l => l.Id == lessonId, ct);
            if (lesson == null) return NotFound();

            var owns = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == lesson.Module.CourseId && ct2.TeacherId == CurrentUserId, ct);
            if (!owns) return Forbid();
        }

        var questionsJson = JsonSerializer.Serialize(req.Questions);
        var test = new Test
        {
            LessonId = lessonId,
            Title = req.Title,
            TimeLimitMinutes = req.TimeLimitMinutes,
            MaxAttempts = req.MaxAttempts,
            PassingPercentage = req.PassingPercentage,
            Questions = JsonDocument.Parse(questionsJson),
            AllowedStudentIds = allowedStudentIds ?? ""
        };
        db.Tests.Add(test);
        await db.SaveChangesAsync(ct);
        return Ok(test);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Update(Guid id, [FromQuery] string? allowedStudentIds, CreateTestRequest req, CancellationToken ct)
    {
        var test = await db.Tests
            .Include(t => t.Lesson).ThenInclude(l => l.Module)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (test == null) return NotFound();

        if (User.IsInRole("Teacher"))
        {
            var owns = await db.CourseTeachers
                .AnyAsync(ct2 => ct2.CourseId == test.Lesson.Module.CourseId && ct2.TeacherId == CurrentUserId, ct);
            if (!owns) return Forbid();
        }

        var questionsJson = JsonSerializer.Serialize(req.Questions);

        test.Title = req.Title;
        test.TimeLimitMinutes = req.TimeLimitMinutes;
        test.MaxAttempts = req.MaxAttempts;
        test.PassingPercentage = req.PassingPercentage;
        test.Questions = JsonDocument.Parse(questionsJson);
        test.AllowedStudentIds = allowedStudentIds ?? "";

        await db.SaveChangesAsync(ct);
        return Ok(test);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var test = await db.Tests.FindAsync([id], ct);
        if (test == null) return NotFound();

        db.Tests.Remove(test);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("generate-from-text")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GenerateFromText([FromBody] string lessonText, CancellationToken ct)
    {
        var json = await ai.GenerateQuizFromTextAsync(lessonText, ct);
        return Content(json, "application/json");
    }

    private record StoredQuestion(
        string Id, string Type, string Text,
        List<StoredOption>? Options,
        string? CorrectAnswer,
        List<string>? CorrectAnswers
    );
    private record StoredOption(string Id, string Text);
}

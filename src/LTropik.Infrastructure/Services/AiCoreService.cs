using System.Net.Http.Json;
using System.Text.Json;
using LTropik.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LTropik.Infrastructure.Services;

public class AiCoreService(
    IApplicationDbContext db,
    IHttpClientFactory httpFactory,
    IAppSettingsService settings,
    ILogger<AiCoreService> logger) : IAiCoreService
{
    public async Task GenerateHomeworkReviewDraftAsync(Guid submissionId, CancellationToken ct)
    {
        var submission = await db.HomeworkSubmissions
            .Include(s => s.Homework)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

        if (submission == null) return;

        var systemPrompt = """
            Ти досвідчений викладач-рецензент. Твоє завдання — дати конструктивний зворотний зв'язок
            на роботу студента. Вказуй на помилки та шляхи їх виправлення. Будь доброзичливим, але точним.
            Не давай готових рішень — лише підказки та напрямок думки. Відповідай мовою завдання.
            """;

        var userMessage = $"""
            Умова завдання:
            {submission.Homework.Instruction}

            Відповідь студента:
            {submission.SubmissionData ?? "(відповідь не надана)"}

            Надай рецензію на цю роботу.
            """;

        try
        {
            var draft = await CallAiAsync(systemPrompt, userMessage, ct);
            submission.AiFeedbackDraft = draft;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "AI generation failed for submission {SubmissionId}", submissionId);
        }
    }

    public async Task<string> GenerateQuizFromTextAsync(string sourceText, CancellationToken ct)
    {
        var systemPrompt = """
            Ти асистент-педагог. З наданого тексту уроку створи 5 питань для тесту.
            Поверни ТІЛЬКИ валідний JSON масив питань наступного формату:
            [{"id":"q1","type":"single","text":"Питання?","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."}],"correctAnswer":"a"}]
            Використовуй типи: "single" (одна відповідь), "multiple" (кілька), "text" (вільна відповідь).
            """;

        return await CallAiAsync(systemPrompt, sourceText, ct);
    }

    public async Task<string> GetTutorResponseAsync(Guid courseId, string studentQuestion, IEnumerable<string> history, CancellationToken ct)
    {
        var systemPrompt = """
            Ти AI-ментор для студента. Твоя роль — підказувати логіку та напрям думки.
            ЗАБОРОНЕНО давати готовий код або повні відповіді. Задавай зустрічні запитання,
            підштовхуй студента до самостійного знаходження рішення. Відповідай коротко (1-3 речення).
            """;

        var messages = history.Select((msg, i) => new
        {
            role = i % 2 == 0 ? "user" : "assistant",
            content = msg
        }).ToList();

        messages.Add(new { role = "user", content = studentQuestion });

        return await CallAiAsync(systemPrompt, null, ct, messages);
    }

    // ── routing: Gemini if key set, otherwise OpenAI ────────────────────────

    private async Task<string> CallAiAsync(
        string systemPrompt,
        string? userMessage,
        CancellationToken ct,
        IEnumerable<object>? messages = null)
    {
        var geminiKey = await settings.GetAsync("Gemini:ApiKey", ct);
        if (!string.IsNullOrWhiteSpace(geminiKey))
            return await CallGeminiAsync(geminiKey, systemPrompt, userMessage, ct, messages);

        var openAiKey = await settings.GetAsync("OpenAI:ApiKey", ct);
        return await CallOpenAiDirectAsync(openAiKey ?? "", systemPrompt, userMessage, ct, messages);
    }

    private async Task<string> CallGeminiAsync(
        string geminiKey,
        string systemPrompt,
        string? userMessage,
        CancellationToken ct,
        IEnumerable<object>? messages = null)
    {
        var model = await settings.GetAsync("Gemini:Model", ct) ?? "gemini-1.5-flash";
        var client = httpFactory.CreateClient();
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={geminiKey}";

        var parts = new List<object>();
        if (messages != null)
        {
            foreach (var msg in messages)
            {
                var json = JsonSerializer.SerializeToElement(msg);
                var role    = json.GetProperty("role").GetString();
                var content = json.GetProperty("content").GetString() ?? "";
                parts.Add(new { role = role == "assistant" ? "model" : "user", parts = new[] { new { text = content } } });
            }
        }
        else
        {
            parts.Add(new { role = "user", parts = new[] { new { text = $"{systemPrompt}\n\n{userMessage}" } } });
        }

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = parts
        };

        try
        {
            var response = await client.PostAsJsonAsync(url, body, ct);
            response.EnsureSuccessStatusCode();
            using var doc = await response.Content.ReadFromJsonAsync<JsonDocument>(ct);
            return doc!.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString() ?? "";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Gemini call failed");
            return "Сервіс AI тимчасово недоступний. Спробуйте пізніше.";
        }
    }

    private async Task<string> CallOpenAiDirectAsync(
        string openAiKey,
        string systemPrompt,
        string? userMessage,
        CancellationToken ct,
        IEnumerable<object>? messages = null)
    {
        if (string.IsNullOrEmpty(openAiKey))
        {
            if (systemPrompt.Contains("масив питань"))
            {
                return """
                [
                  {
                    "id": "ai-q1",
                    "type": "single",
                    "text": "Яка першочергова мета вивчення теми?",
                    "options": [
                      {"id": "a", "text": "Здобути глибокі практичні навички"},
                      {"id": "b", "text": "Просто отримати оцінку"},
                      {"id": "c", "text": "Перенести заняття"}
                    ],
                    "correctAnswer": "a"
                  }
                ]
                """;
            }
            return "AI не налаштовано. Вкажіть OpenAI або Gemini API ключ у Адмін → Налаштування.";
        }

        var model = await settings.GetAsync("OpenAI:Model", ct) ?? "gpt-4o-mini";
        var client = httpFactory.CreateClient("openai");
        client.DefaultRequestHeaders.Remove("Authorization");
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {openAiKey}");

        var msgList = new List<object> { new { role = "system", content = systemPrompt } };
        if (messages != null)
            msgList.AddRange(messages);
        else if (userMessage != null)
            msgList.Add(new { role = "user", content = userMessage });

        var body = new { model, messages = msgList, max_tokens = 1500, temperature = 0.7 };

        var response = await client.PostAsJsonAsync("/v1/chat/completions", body, ct);
        response.EnsureSuccessStatusCode();

        using var doc = await response.Content.ReadFromJsonAsync<JsonDocument>(ct);
        return doc!.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "";
    }
}

using System.Security.Claims;
using System.Text.Json;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FlashcardsController(IApplicationDbContext db, IAiCoreService ai) : ControllerBase
{
    private Guid Me => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Sets ───────────────────────────────────────────────────────────────────
    [HttpGet("sets")]
    public async Task<IActionResult> GetSets(CancellationToken ct)
    {
        var sets = await db.FlashcardSets
            .Where(s => s.UserId == Me)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { s.Id, s.Title, s.LessonId, s.CreatedAt, CardCount = s.Cards.Count })
            .ToListAsync(ct);
        return Ok(sets);
    }

    [HttpGet("sets/{setId:guid}")]
    public async Task<IActionResult> GetSet(Guid setId, CancellationToken ct)
    {
        var set = await db.FlashcardSets
            .Include(s => s.Cards)
            .FirstOrDefaultAsync(s => s.Id == setId && s.UserId == Me, ct);
        if (set is null) return NotFound();

        return Ok(new
        {
            set.Id, set.Title, set.LessonId, set.CreatedAt,
            Cards = set.Cards.OrderBy(c => c.SortOrder).Select(c => new { c.Id, c.Front, c.Back, c.SortOrder })
        });
    }

    [HttpPost("sets")]
    public async Task<IActionResult> CreateSet([FromBody] CreateSetRequest req, CancellationToken ct)
    {
        var set = new FlashcardSet { UserId = Me, Title = req.Title, LessonId = req.LessonId };
        db.FlashcardSets.Add(set);

        if (req.Cards is { Length: > 0 })
        {
            for (int i = 0; i < req.Cards.Length; i++)
            {
                db.Flashcards.Add(new Flashcard { SetId = set.Id, Front = req.Cards[i].Front, Back = req.Cards[i].Back, SortOrder = i });
            }
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { set.Id });
    }

    [HttpDelete("sets/{setId:guid}")]
    public async Task<IActionResult> DeleteSet(Guid setId, CancellationToken ct)
    {
        var set = await db.FlashcardSets.FirstOrDefaultAsync(s => s.Id == setId && s.UserId == Me, ct);
        if (set is null) return NotFound();
        db.FlashcardSets.Remove(set);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── Cards CRUD ─────────────────────────────────────────────────────────────
    [HttpPost("sets/{setId:guid}/cards")]
    public async Task<IActionResult> AddCard(Guid setId, [FromBody] CardRequest req, CancellationToken ct)
    {
        var set = await db.FlashcardSets.FirstOrDefaultAsync(s => s.Id == setId && s.UserId == Me, ct);
        if (set is null) return NotFound();
        var count = await db.Flashcards.CountAsync(c => c.SetId == setId, ct);
        var card = new Flashcard { SetId = setId, Front = req.Front, Back = req.Back, SortOrder = count };
        db.Flashcards.Add(card);
        await db.SaveChangesAsync(ct);
        return Ok(new { card.Id });
    }

    [HttpPut("cards/{cardId:guid}")]
    public async Task<IActionResult> UpdateCard(Guid cardId, [FromBody] CardRequest req, CancellationToken ct)
    {
        var card = await db.Flashcards
            .Include(c => c.Set)
            .FirstOrDefaultAsync(c => c.Id == cardId && c.Set.UserId == Me, ct);
        if (card is null) return NotFound();
        card.Front = req.Front;
        card.Back  = req.Back;
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("cards/{cardId:guid}")]
    public async Task<IActionResult> DeleteCard(Guid cardId, CancellationToken ct)
    {
        var card = await db.Flashcards.Include(c => c.Set).FirstOrDefaultAsync(c => c.Id == cardId && c.Set.UserId == Me, ct);
        if (card is null) return NotFound();
        db.Flashcards.Remove(card);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // ── AI generation ──────────────────────────────────────────────────────────
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Text))
            return BadRequest(new { error = "Текст не може бути порожнім" });

        var example = """[{"front":"Питання?","back":"Відповідь"}]""";
        var prompt = $"""
            Створи 8-12 флешкарток для запам'ятовування на основі тексту нижче.
            Поверни ТІЛЬКИ валідний JSON масив:
            {example}
            Не додавай нічого крім JSON. Текст:
            {req.Text.Substring(0, Math.Min(req.Text.Length, 2000))}
            """;

        try
        {
            var raw = await ai.GetTutorResponseAsync(Guid.Empty, prompt, [], ct);
            // Find JSON array in response
            var start = raw.IndexOf('[');
            var end   = raw.LastIndexOf(']');
            if (start < 0 || end < 0) return BadRequest(new { error = "AI повернув неправильний формат" });

            var json  = raw[start..(end + 1)];
            var cards = JsonSerializer.Deserialize<CardDto[]>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return Ok(cards ?? []);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Помилка генерації: {ex.Message}" });
        }
    }
}

public record CreateSetRequest(string Title, Guid? LessonId, CardRequest[]? Cards);
public record CardRequest(string Front, string Back);
public record GenerateRequest(string Text);
public record CardDto(string Front, string Back);

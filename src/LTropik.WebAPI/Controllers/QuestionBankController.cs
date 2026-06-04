using System.Text.Json;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Teacher")]
public class QuestionBankController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category, [FromQuery] string? tag, CancellationToken ct)
    {
        IQueryable<QuestionBankItem> query = db.QuestionBankItems;
        if (!string.IsNullOrEmpty(category))
            query = query.Where(q => q.Category == category);
        if (!string.IsNullOrEmpty(tag))
            query = query.Where(q => q.Tags != null && q.Tags.Contains(tag));

        var raw = await query
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync(ct);

        var items = raw.Select(q => new
        {
            q.Id, q.Text, q.Type,
            Options = JsonSerializer.Deserialize<object[]>(q.Options.RootElement.GetRawText()),
            q.Tags, q.Category, q.CreatedAt
        });

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuestionBankItemRequest req, CancellationToken ct)
    {
        var item = new QuestionBankItem
        {
            Text = req.Text,
            Type = req.Type,
            Options = JsonDocument.Parse(JsonSerializer.Serialize(req.Options)),
            Tags = req.Tags,
            Category = req.Category
        };
        db.QuestionBankItems.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateQuestionBankItemRequest req, CancellationToken ct)
    {
        var item = await db.QuestionBankItems.FindAsync([id], ct);
        if (item == null) return NotFound();

        item.Text = req.Text;
        item.Type = req.Type;
        item.Options = JsonDocument.Parse(JsonSerializer.Serialize(req.Options));
        item.Tags = req.Tags;
        item.Category = req.Category;

        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await db.QuestionBankItems.FindAsync([id], ct);
        if (item == null) return NotFound();
        db.QuestionBankItems.Remove(item);
        await db.SaveChangesAsync(ct);
        return Ok();
    }
}

public record CreateQuestionBankItemRequest(
    string Text,
    string Type,
    object[] Options,
    string? Tags,
    string? Category);

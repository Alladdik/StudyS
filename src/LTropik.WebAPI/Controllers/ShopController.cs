using System.Security.Claims;
using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using LTropik.Domain.Entities;
using LTropik.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShopController(IApplicationDbContext db, IGamificationService gamification, AppDbContext appDb) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // All: list active shop items
    [HttpGet]
    public async Task<IActionResult> GetItems(CancellationToken ct)
    {
        var items = await db.ShopItems
            .Where(i => i.IsActive)
            .OrderBy(i => i.CoinsPrice)
            .ToListAsync(ct);
        return Ok(items);
    }

    // Student: buy an item
    [HttpPost("{itemId:guid}/buy")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Buy(Guid itemId, [FromBody] BuyItemRequest? req, CancellationToken ct)
    {
        var item = await db.ShopItems.FindAsync([itemId], ct);
        if (item == null || !item.IsActive)
            return NotFound(new { error = "Товар не знайдено" });

        // Check max per student
        if (item.MaxPerStudent.HasValue)
        {
            var count = await db.ShopPurchases
                .CountAsync(p => p.StudentId == CurrentUserId && p.ItemId == itemId, ct);
            if (count >= item.MaxPerStudent)
                return BadRequest(new { error = $"Ви вже купували цей товар максимальну кількість разів ({item.MaxPerStudent})" });
        }

        // Deduct coins AND create purchase record in a single transaction
        await using var tx = await appDb.Database.BeginTransactionAsync(ct);
        try
        {
            await gamification.SpendCoinsAsync(CurrentUserId, item.CoinsPrice, ct);

            var purchase = new ShopPurchase
            {
                StudentId       = CurrentUserId,
                ItemId          = itemId,
                ContextCourseId = req?.CourseId
            };
            db.ShopPurchases.Add(purchase);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Ok(new { purchaseId = purchase.Id, message = $"Ви придбали «{item.Name}»!" });
        }
        catch (InvalidOperationException ex)
        {
            await tx.RollbackAsync(ct);
            return BadRequest(new { error = ex.Message });
        }
        catch
        {
            await tx.RollbackAsync(ct);
            return StatusCode(500, new { error = "Помилка транзакції — спробуйте знову" });
        }
    }

    // Student: my purchases
    [HttpGet("my-purchases")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> MyPurchases(CancellationToken ct)
    {
        var list = await db.ShopPurchases
            .Include(p => p.Item)
            .Where(p => p.StudentId == CurrentUserId)
            .OrderByDescending(p => p.PurchasedAt)
            .Select(p => new
            {
                p.Id,
                p.PurchasedAt,
                p.UsedAt,
                Item = new { p.Item.Id, p.Item.Name, p.Item.Icon, p.Item.Type, p.Item.Description }
            })
            .ToListAsync(ct);
        return Ok(list);
    }

    // Student: use a purchase (mark as used)
    [HttpPost("purchases/{purchaseId:guid}/use")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Use(Guid purchaseId, CancellationToken ct)
    {
        var p = await db.ShopPurchases
            .Include(x => x.Item)
            .FirstOrDefaultAsync(x => x.Id == purchaseId && x.StudentId == CurrentUserId, ct);

        if (p == null) return NotFound();
        if (p.UsedAt != null) return Conflict(new { error = "Товар вже використано" });

        p.UsedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return Ok(new { message = $"«{p.Item.Name}» використано!" });
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> CreateItem([FromBody] CreateShopItemRequest req, CancellationToken ct)
    {
        var item = new ShopItem
        {
            Name         = req.Name,
            Description  = req.Description,
            Icon         = req.Icon ?? "🎁",
            Type         = req.Type,
            CoinsPrice   = req.CoinsPrice,
            MaxPerStudent = req.MaxPerStudent
        };
        db.ShopItems.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] CreateShopItemRequest req, CancellationToken ct)
    {
        var item = await db.ShopItems.FindAsync([id], ct);
        if (item == null) return NotFound();

        item.Name         = req.Name;
        item.Description  = req.Description;
        item.Icon         = req.Icon ?? item.Icon;
        item.Type         = req.Type;
        item.CoinsPrice   = req.CoinsPrice;
        item.MaxPerStudent = req.MaxPerStudent;
        await db.SaveChangesAsync(ct);
        return Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken ct)
    {
        var item = await db.ShopItems.FindAsync([id], ct);
        if (item == null) return NotFound();
        item.IsActive = false;
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // Admin: seed default shop items
    [HttpPost("seed")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Seed(CancellationToken ct)
    {
        if (await db.ShopItems.AnyAsync(ct))
            return Conflict(new { error = "Товари вже існують" });

        var items = new List<ShopItem>
        {
            new() { Name = "Підказка до ДЗ",          Description = "AI-підказка без готової відповіді",      Icon = "💡", Type = "hint",            CoinsPrice = 20,  MaxPerStudent = 3 },
            new() { Name = "Скасування пропуску",      Description = "Видалити 1 НБ з журналу",                Icon = "🛡️", Type = "skip_absence",     CoinsPrice = 80,  MaxPerStudent = 2 },
            new() { Name = "Бонусний матеріал",         Description = "Розблокувати додатковий урок",           Icon = "📖", Type = "unlock_material",   CoinsPrice = 50  },
            new() { Name = "Подяка вчителю",            Description = "Надіслати подяку викладачу",             Icon = "🌷", Type = "custom",            CoinsPrice = 15  },
            new() { Name = "Сертифікат досягнень",     Description = "Персональний PDF-сертифікат",             Icon = "🏆", Type = "certificate",       CoinsPrice = 150, MaxPerStudent = 1 },
        };
        db.ShopItems.AddRange(items);
        await db.SaveChangesAsync(ct);
        return Ok(new { seeded = items.Count });
    }
}

public record BuyItemRequest(Guid? CourseId);
public record CreateShopItemRequest(
    [property: System.ComponentModel.DataAnnotations.Required] string Name,
    string Description,
    string? Icon,
    [property: System.ComponentModel.DataAnnotations.Required] string Type,
    [property: System.ComponentModel.DataAnnotations.Range(0, int.MaxValue)] int CoinsPrice,
    int? MaxPerStudent);

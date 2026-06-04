using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Application.Services;
using LTropik.Domain.Entities;
using LTropik.Domain.Enums;
using LTropik.WebAPI.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class UsersController(IApplicationDbContext db, AuthService auth) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? role,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = db.Users.AsQueryable();

        if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, true, out var r))
            query = query.Where(u => u.Role == r);

        if (!string.IsNullOrEmpty(search))
            query = query.Where(u =>
                u.FirstName.Contains(search) ||
                u.LastName.Contains(search) ||
                u.Email.Contains(search));

        var total = await query.CountAsync(ct);
        var users = await query
            .OrderBy(u => u.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                Role = u.Role.ToString(),
                IsBlocked = !u.IsActive,
                u.TelegramId,
                u.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items = users });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var user = await db.Users
            .Include(u => u.CustomValues).ThenInclude(v => v.Field)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user == null) return NotFound();

        // Never return PasswordHash in API responses
        return Ok(new
        {
            user.Id, user.Email, user.FirstName, user.LastName,
            Role       = user.Role.ToString(),
            user.TelegramId,
            IsBlocked  = !user.IsActive,
            user.CreatedAt,
            CustomValues = user.CustomValues.Select(v => new { v.FieldId, v.Field.FieldName, v.FieldValue })
        });
    }

    [HttpPost]
    [Audit("UserCreated")]
    public async Task<IActionResult> Create(RegisterRequest req, CancellationToken ct)
    {
        try
        {
            var id = await auth.RegisterAsync(req, ct);
            return Ok(new { id });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/block")]
    [Authorize(Roles = "Admin")]
    [Audit("UserBlocked")]
    public async Task<IActionResult> Block(Guid id, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user == null) return NotFound();
        user.IsActive = false;
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPatch("{id:guid}/unblock")]
    [Authorize(Roles = "Admin")]
    [Audit("UserUnblocked")]
    public async Task<IActionResult> Unblock(Guid id, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user == null) return NotFound();
        user.IsActive = true;
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPut("{id:guid}/custom-fields")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateCustomFields(
        Guid id,
        [FromBody] Dictionary<Guid, string> fieldValues,
        CancellationToken ct)
    {
        var user = await db.Users
            .Include(u => u.CustomValues)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user == null) return NotFound();

        foreach (var (fieldId, value) in fieldValues)
        {
            var existing = user.CustomValues.FirstOrDefault(v => v.FieldId == fieldId);
            if (existing != null)
                existing.FieldValue = value;
            else
                db.UserCustomValues.Add(new UserCustomValue
                {
                    UserId = id,
                    FieldId = fieldId,
                    FieldValue = value
                });
        }

        await db.SaveChangesAsync(ct);
        return Ok();
    }

    // Custom profile field management
    [HttpGet("custom-fields")]
    public async Task<IActionResult> GetCustomFields(CancellationToken ct) =>
        Ok(await db.CustomProfileFields.ToListAsync(ct));

    [HttpPost("custom-fields")]
    [Authorize(Roles = "Admin")]
    [Audit("CustomFieldCreated")]
    public async Task<IActionResult> AddCustomField(
        [FromBody] CustomFieldRequest req,
        CancellationToken ct)
    {
        var field = new CustomProfileField
        {
            FieldName = req.FieldName,
            FieldType = req.FieldType,
            IsRequired = req.IsRequired
        };
        db.CustomProfileFields.Add(field);
        await db.SaveChangesAsync(ct);
        return Ok(field);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("UserUpdated")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest req, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user == null) return NotFound();

        user.Email = req.Email;
        user.FirstName = req.FirstName;
        user.LastName = req.LastName;
        if (Enum.TryParse<UserRole>(req.Role, true, out var role))
        {
            user.Role = role;
        }

        if (!string.IsNullOrEmpty(req.Password))
        {
            user.PasswordHash = AuthService.HashPassword(req.Password);
        }

        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("UserDeleted")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user == null) return NotFound();

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("{id:guid}/impersonate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Impersonate(Guid id, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user == null) return NotFound();

        var token = auth.GenerateToken(user);
        return Ok(new LoginResponse(token, "", user.Role.ToString(), user.Id));
    }
}

public record CustomFieldRequest(string FieldName, string FieldType, bool IsRequired);
public record UpdateUserRequest(string Email, string FirstName, string LastName, string Role, string? Password);

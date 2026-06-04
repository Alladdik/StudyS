using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.WebAPI.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GradeScalesController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var scales = await db.GradeScales
            .Include(s => s.Values)
            .Select(s => new GradeScaleDto(
                s.Id, s.Name,
                s.Values.Select(v => new GradeScaleValueFullDto(v.Id, v.ValueString, v.IsPassing)).ToList()))
            .ToListAsync(ct);
        return Ok(scales);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [Audit("GradeScaleCreated")]
    public async Task<IActionResult> Create(CreateGradeScaleRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Назва шкали обов'язкова" });
        if (req.Values == null || req.Values.Count == 0)
            return BadRequest(new { error = "Шкала повинна мати хоча б одне значення" });

        var scale = new GradeScale { Name = req.Name };
        scale.Values = req.Values.Select(v => new GradeScaleValue
        {
            ScaleId = scale.Id,
            ValueString = v.ValueString,
            IsPassing = v.IsPassing
        }).ToList();

        db.GradeScales.Add(scale);
        await db.SaveChangesAsync(ct);
        return Ok(new GradeScaleDto(
            scale.Id, scale.Name,
            scale.Values.Select(v => new GradeScaleValueFullDto(v.Id, v.ValueString, v.IsPassing)).ToList()));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("GradeScaleUpdated")]
    public async Task<IActionResult> Update(Guid id, CreateGradeScaleRequest req, CancellationToken ct)
    {
        var scale = await db.GradeScales
            .Include(s => s.Values)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (scale == null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Назва шкали обов'язкова" });
        if (req.Values == null || req.Values.Count == 0)
            return BadRequest(new { error = "Шкала повинна мати хоча б одне значення" });

        scale.Name = req.Name;

        // Clear old values and insert new ones
        db.GradeScaleValues.RemoveRange(scale.Values);
        scale.Values = req.Values.Select(v => new GradeScaleValue
        {
            ScaleId = scale.Id,
            ValueString = v.ValueString,
            IsPassing = v.IsPassing
        }).ToList();

        await db.SaveChangesAsync(ct);
        return Ok(new GradeScaleDto(
            scale.Id, scale.Name,
            scale.Values.Select(v => new GradeScaleValueFullDto(v.Id, v.ValueString, v.IsPassing)).ToList()));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [Audit("GradeScaleDeleted")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var scale = await db.GradeScales.FindAsync([id], ct);
        if (scale == null) return NotFound();

        db.GradeScales.Remove(scale);
        await db.SaveChangesAsync(ct);
        return Ok();
    }
}

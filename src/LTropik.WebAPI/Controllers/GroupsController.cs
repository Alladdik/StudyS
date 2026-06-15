using System.Security.Claims;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class GroupsController(IApplicationDbContext db, IEmailService email) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var groups = await db.StudentGroups
            .Select(g => new StudentGroupDto(
                g.Id, g.Name, g.Description,
                g.Members.Count, g.CreatedAt))
            .ToListAsync(ct);
        return Ok(groups);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var group = await db.StudentGroups.FindAsync([id], ct);
        if (group == null) return NotFound();

        var members = await db.GroupMembers
            .Where(gm => gm.GroupId == id)
            .Include(gm => gm.Student)
            .Select(gm => new GroupMemberDto(
                gm.StudentId,
                gm.Student.FirstName + " " + gm.Student.LastName,
                gm.Student.Email))
            .ToListAsync(ct);

        return Ok(new { group.Id, group.Name, group.Description, members });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create(CreateGroupRequest req, CancellationToken ct)
    {
        var group = new StudentGroup { Name = req.Name, Description = req.Description };
        db.StudentGroups.Add(group);
        await db.SaveChangesAsync(ct);
        return Ok(new { group.Id });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, UpdateGroupRequest req, CancellationToken ct)
    {
        var group = await db.StudentGroups.FindAsync([id], ct);
        if (group == null) return NotFound();
        if (req.Name != null) group.Name = req.Name;
        if (req.Description != null) group.Description = req.Description;
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var group = await db.StudentGroups.FindAsync([id], ct);
        if (group == null) return NotFound();
        db.StudentGroups.Remove(group);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, AddGroupMemberRequest req, CancellationToken ct)
    {
        if (await db.GroupMembers.AnyAsync(gm => gm.GroupId == id && gm.StudentId == req.StudentId, ct))
            return Conflict("Студент вже в групі");

        db.GroupMembers.Add(new GroupMember { GroupId = id, StudentId = req.StudentId });
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{id:guid}/members/{studentId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid studentId, CancellationToken ct)
    {
        var member = await db.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == id && gm.StudentId == studentId, ct);
        if (member == null) return NotFound();
        db.GroupMembers.Remove(member);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("{id:guid}/broadcast")]
    public async Task<IActionResult> Broadcast(Guid id, BroadcastGroupMessageRequest req, CancellationToken ct)
    {
        var members = await db.GroupMembers
            .Where(gm => gm.GroupId == id)
            .Include(gm => gm.Student)
            .ToListAsync(ct);

        foreach (var m in members)
            await email.SendAsync(m.Student.Email, req.Subject, req.HtmlBody, ct: ct);

        return Ok(new { sent = members.Count });
    }
}

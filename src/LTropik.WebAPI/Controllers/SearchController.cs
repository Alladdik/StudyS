using System.Security.Claims;
using LTropik.Application.DTOs;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SearchController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new SearchResponse([], 0));

        var term = q.Trim().ToLower();
        var results = new List<SearchResultDto>();
        var role = User.FindFirstValue(ClaimTypes.Role);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Courses
        IQueryable<Domain.Entities.Course> courseQuery = db.Courses;
        if (role == "Student")
            courseQuery = courseQuery.Where(c => c.Students.Any(s => s.StudentId == userId));
        else if (role == "Teacher")
            courseQuery = courseQuery.Where(c => c.Teachers.Any(t => t.TeacherId == userId));

        var courses = await courseQuery
            .Where(c => c.Title.ToLower().Contains(term) || (c.Description != null && c.Description.ToLower().Contains(term)))
            .Take(5)
            .Select(c => new SearchResultDto("Курси", c.Id, c.Title, c.Description, $"/student/courses"))
            .ToListAsync(ct);
        results.AddRange(courses);

        // Lessons
        var lessons = await db.Lessons
            .Where(l => l.Title.ToLower().Contains(term))
            .Take(5)
            .Select(l => new SearchResultDto("Уроки", l.Id, l.Title, l.Module.Course.Title, $"/student/lesson/{l.Id}"))
            .ToListAsync(ct);
        results.AddRange(lessons);

        // Students (admin/teacher only)
        if (role is "Admin" or "Teacher")
        {
            var students = await db.Users
                .Where(u => u.Role == Domain.Enums.UserRole.Student &&
                            (u.FirstName.ToLower().Contains(term) ||
                             u.LastName.ToLower().Contains(term) ||
                             u.Email.ToLower().Contains(term)))
                .Take(5)
                .Select(u => new SearchResultDto("Студенти", u.Id, u.FirstName + " " + u.LastName, u.Email, null))
                .ToListAsync(ct);
            results.AddRange(students);
        }

        return Ok(new SearchResponse(results, results.Count));
    }
}

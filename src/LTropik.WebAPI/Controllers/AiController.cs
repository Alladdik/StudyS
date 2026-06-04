using System.Security.Claims;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Student")]
public class AiController(IAiCoreService ai) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("tutor/{courseId:guid}")]
    public async Task<IActionResult> AskTutor(
        Guid courseId,
        [FromBody] TutorRequest req,
        CancellationToken ct)
    {
        var response = await ai.GetTutorResponseAsync(courseId, req.Question, req.History, ct);
        return Ok(new { response });
    }
}

public record TutorRequest(string Question, List<string> History);

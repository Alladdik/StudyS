using System.Security.Claims;
using LTropik.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LTropik.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController(IAiCoreService ai) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── AI mentor — staff only (hidden from students) ────────────────────────
    [HttpPost("tutor/{courseId:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> AskTutor(
        Guid courseId,
        [FromBody] TutorRequest req,
        CancellationToken ct)
    {
        var response = await ai.GetTutorResponseAsync(courseId, req.Question, req.History, ct);
        return Ok(new { response });
    }

    // ── Teacher/Admin: AI test builder chat ──────────────────────────────────
    [HttpPost("test-builder/chat")]
    [Authorize(Roles = "Teacher,Admin,Manager")]
    public async Task<IActionResult> TestBuilderChat(
        [FromBody] TestBuilderChatRequest req,
        CancellationToken ct)
    {
        var reply = await ai.TestBuilderChatAsync(req.Messages, ct);
        return Ok(new { message = reply.Message, questionsJson = reply.QuestionsJson });
    }
}

public record TutorRequest(string Question, List<string> History);
public record TestBuilderChatRequest(List<ChatTurn> Messages);

namespace LTropik.Application.DTOs;

public record StudentGroupDto(
    Guid Id,
    string Name,
    string? Description,
    int MemberCount,
    DateTimeOffset CreatedAt);

public record GroupMemberDto(
    Guid StudentId,
    string StudentName,
    string Email);

public record CreateGroupRequest(string Name, string? Description);
public record UpdateGroupRequest(string? Name, string? Description);
public record AddGroupMemberRequest(Guid StudentId);
public record BroadcastGroupMessageRequest(string Subject, string HtmlBody);

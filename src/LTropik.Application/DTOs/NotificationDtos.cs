namespace LTropik.Application.DTOs;

public record AppNotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Body,
    bool IsRead,
    string? ActionUrl,
    DateTimeOffset CreatedAt);

public record MarkReadRequest(Guid[] Ids);

namespace LTropik.Application.DTOs;

public record SearchResultDto(
    string Category, // Courses, Lessons, Students
    Guid Id,
    string Title,
    string? Subtitle,
    string? Url);

public record SearchResponse(IReadOnlyList<SearchResultDto> Results, int Total);

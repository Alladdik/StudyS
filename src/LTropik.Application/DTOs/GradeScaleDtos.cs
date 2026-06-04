namespace LTropik.Application.DTOs;

public record CreateGradeScaleRequest(string Name, List<GradeScaleValueDto> Values);

public record GradeScaleValueDto(string ValueString, bool IsPassing);

public record GradeScaleDto(Guid Id, string Name, List<GradeScaleValueFullDto> Values);

public record GradeScaleValueFullDto(Guid Id, string ValueString, bool IsPassing);

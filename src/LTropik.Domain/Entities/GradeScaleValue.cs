namespace LTropik.Domain.Entities;

public class GradeScaleValue
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ScaleId { get; set; }
    public string ValueString { get; set; } = string.Empty; // "12", "A", "Зараховано"
    public bool IsPassing { get; set; } = true;

    public GradeScale Scale { get; set; } = null!;
}

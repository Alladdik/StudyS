namespace LTropik.Domain.Entities;

public class UserCustomValue
{
    public Guid UserId { get; set; }
    public Guid FieldId { get; set; }
    public string? FieldValue { get; set; }

    public User User { get; set; } = null!;
    public CustomProfileField Field { get; set; } = null!;
}

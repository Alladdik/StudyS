namespace LTropik.Domain.Entities;

public class CustomProfileField
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FieldName { get; set; } = string.Empty;
    public string FieldType { get; set; } = "text"; // 'text', 'number', 'boolean'
    public bool IsRequired { get; set; }

    public ICollection<UserCustomValue> Values { get; set; } = [];
}

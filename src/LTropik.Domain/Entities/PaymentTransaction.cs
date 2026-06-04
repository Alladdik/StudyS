namespace LTropik.Domain.Entities;

public class PaymentTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid? CourseId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "UAH";
    public string Status { get; set; } = "Pending"; // "Success", "Pending", "Failed"
    public string? ExternalTxId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public User Student { get; set; } = null!;
    public Course? Course { get; set; }
}

namespace LTropik.Domain.Entities;

public class ShopPurchase
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? ContextCourseId { get; set; }
    public DateTimeOffset PurchasedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UsedAt { get; set; }

    public User Student { get; set; } = null!;
    public ShopItem Item { get; set; } = null!;
}

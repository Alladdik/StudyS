namespace LTropik.Domain.Entities;

public class ShopItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "🎁";
    // hint | unlock_material | skip_absence | custom
    public string Type { get; set; } = "custom";
    public int CoinsPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public int? MaxPerStudent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ShopPurchase> Purchases { get; set; } = [];
}

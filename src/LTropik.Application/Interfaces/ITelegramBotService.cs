using System.Text.Json;

namespace LTropik.Application.Interfaces;

public interface ITelegramBotService
{
    Task HandleUpdateAsync(JsonElement update, CancellationToken ct = default);
}

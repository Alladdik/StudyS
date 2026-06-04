namespace LTropik.Application.Interfaces;

public interface INotificationHub
{
    Task PushAsync(Guid userId, object payload);
}

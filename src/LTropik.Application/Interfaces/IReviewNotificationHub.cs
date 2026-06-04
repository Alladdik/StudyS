namespace LTropik.Application.Interfaces;

public interface IReviewNotificationHub
{
    Task NotifyReviewReadyAsync(Guid teacherId, Guid submissionId);
}

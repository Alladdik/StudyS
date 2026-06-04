namespace LTropik.Application.Interfaces;

public interface ITelegramNotificationService
{
    Task SendAsync(string telegramId, string message, CancellationToken ct = default);
    Task NotifyGradeChangedAsync(Guid studentId, string gradeName, string courseName, CancellationToken ct = default);
    Task NotifyHomeworkReviewReadyAsync(Guid teacherId, Guid submissionId, string studentName, CancellationToken ct = default);
    Task NotifyPaymentStatusAsync(Guid studentId, string status, decimal amount, CancellationToken ct = default);
    // Notify parents when child gets a grade
    Task NotifyParentsAboutGradeAsync(Guid studentId, string gradeName, string courseName, CancellationToken ct = default);
    // Notify student + parents when student is marked absent
    Task NotifyAbsenceAsync(Guid studentId, string courseName, string lessonDate, CancellationToken ct = default);
    // Send 2FA login code
    Task Send2faCodeAsync(string telegramId, string code, CancellationToken ct = default);
}

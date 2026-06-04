using LTropik.Domain.Enums;

namespace LTropik.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string? TelegramId { get; set; }
    public string? TelegramLinkCode { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsEmailVerified { get; set; } = false;
    public string? EmailVerifyToken { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<UserCustomValue> CustomValues { get; set; } = [];
    public ICollection<CourseStudent> EnrolledCourses { get; set; } = [];
    public ICollection<CourseTeacher> TeachingCourses { get; set; } = [];
    public ICollection<HomeworkSubmission> HomeworkSubmissions { get; set; } = [];
    public ICollection<TestAttempt> TestAttempts { get; set; } = [];
    public ICollection<AttendanceAndGrade> AttendanceRecords { get; set; } = [];
}

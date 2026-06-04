using LTropik.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LTropik.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<CustomProfileField> CustomProfileFields { get; }
    DbSet<UserCustomValue> UserCustomValues { get; }
    DbSet<GradeScale> GradeScales { get; }
    DbSet<GradeScaleValue> GradeScaleValues { get; }
    DbSet<Course> Courses { get; }
    DbSet<CourseTeacher> CourseTeachers { get; }
    DbSet<CourseStudent> CourseStudents { get; }
    DbSet<Module> Modules { get; }
    DbSet<Lesson> Lessons { get; }
    DbSet<Homework> Homeworks { get; }
    DbSet<HomeworkSubmission> HomeworkSubmissions { get; }
    DbSet<AttendanceAndGrade> AttendanceAndGrades { get; }
    DbSet<Test> Tests { get; }
    DbSet<TestAttempt> TestAttempts { get; }
    DbSet<PaymentTransaction> PaymentTransactions { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<Badge> Badges { get; }
    DbSet<StudentBadge> StudentBadges { get; }
    DbSet<StudentStreak> StudentStreaks { get; }
    DbSet<Room> Rooms { get; }
    DbSet<RoomMessage> RoomMessages { get; }
    DbSet<ParentStudent> ParentStudents { get; }
    DbSet<AppNotification> AppNotifications { get; }
    DbSet<Schedule> Schedules { get; }
    DbSet<CourseProgress> CourseProgresses { get; }
    DbSet<StudentGroup> StudentGroups { get; }
    DbSet<GroupMember> GroupMembers { get; }
    DbSet<LessonComment> LessonComments { get; }
    DbSet<QuestionBankItem> QuestionBankItems { get; }
    DbSet<EnrollmentRequest> EnrollmentRequests { get; }
    DbSet<ShopItem> ShopItems { get; }
    DbSet<ShopPurchase> ShopPurchases { get; }
    DbSet<DailyQuest> DailyQuests { get; }
    DbSet<StudentDailyQuest> StudentDailyQuests { get; }
    DbSet<CourseReview> CourseReviews { get; }
    DbSet<DirectMessage> DirectMessages { get; }
    DbSet<MessageReaction> MessageReactions { get; }
    DbSet<LessonRecording> LessonRecordings { get; }
    DbSet<AppSetting> AppSettings { get; }
    DbSet<LessonNote> LessonNotes { get; }
    DbSet<Bookmark> Bookmarks { get; }
    DbSet<FlashcardSet> FlashcardSets { get; }
    DbSet<Flashcard> Flashcards { get; }
    DbSet<PushSubscription> PushSubscriptions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

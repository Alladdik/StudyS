using System.Text.Json;
using LTropik.Application.Interfaces;
using LTropik.Domain.Entities;
using LTropik.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace LTropik.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : DbContext(options), IApplicationDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<CustomProfileField> CustomProfileFields => Set<CustomProfileField>();
    public DbSet<UserCustomValue> UserCustomValues => Set<UserCustomValue>();
    public DbSet<GradeScale> GradeScales => Set<GradeScale>();
    public DbSet<GradeScaleValue> GradeScaleValues => Set<GradeScaleValue>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CourseTeacher> CourseTeachers => Set<CourseTeacher>();
    public DbSet<CourseStudent> CourseStudents => Set<CourseStudent>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Homework> Homeworks => Set<Homework>();
    public DbSet<HomeworkSubmission> HomeworkSubmissions => Set<HomeworkSubmission>();
    public DbSet<AttendanceAndGrade> AttendanceAndGrades => Set<AttendanceAndGrade>();
    public DbSet<Test> Tests => Set<Test>();
    public DbSet<TestAttempt> TestAttempts => Set<TestAttempt>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Badge> Badges => Set<Badge>();
    public DbSet<StudentBadge> StudentBadges => Set<StudentBadge>();
    public DbSet<StudentStreak> StudentStreaks => Set<StudentStreak>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomMessage> RoomMessages => Set<RoomMessage>();
    public DbSet<ParentStudent> ParentStudents => Set<ParentStudent>();
    public DbSet<AppNotification> AppNotifications => Set<AppNotification>();
    public DbSet<Schedule> Schedules => Set<Schedule>();
    public DbSet<CourseProgress> CourseProgresses => Set<CourseProgress>();
    public DbSet<StudentGroup> StudentGroups => Set<StudentGroup>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<LessonComment> LessonComments => Set<LessonComment>();
    public DbSet<QuestionBankItem> QuestionBankItems => Set<QuestionBankItem>();
    public DbSet<EnrollmentRequest> EnrollmentRequests => Set<EnrollmentRequest>();
    public DbSet<ShopItem> ShopItems => Set<ShopItem>();
    public DbSet<ShopPurchase> ShopPurchases => Set<ShopPurchase>();
    public DbSet<DailyQuest> DailyQuests => Set<DailyQuest>();
    public DbSet<StudentDailyQuest> StudentDailyQuests => Set<StudentDailyQuest>();
    public DbSet<CourseReview> CourseReviews => Set<CourseReview>();
    public DbSet<DirectMessage> DirectMessages => Set<DirectMessage>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();
    public DbSet<LessonRecording> LessonRecordings => Set<LessonRecording>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<LessonNote> LessonNotes => Set<LessonNote>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<FlashcardSet> FlashcardSets => Set<FlashcardSet>();
    public DbSet<Flashcard> Flashcards => Set<Flashcard>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    private static JsonDocument ParseJsonDoc(string v) =>
        JsonDocument.Parse(v, new JsonDocumentOptions());

    private static readonly ValueConverter<JsonDocument, string> JsonDocConverter = new(
        v => v.RootElement.GetRawText(),
        v => ParseJsonDoc(v));

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // User
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(255).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Role).HasConversion(new EnumToStringConverter<UserRole>());
        });

        // Custom fields
        b.Entity<CustomProfileField>(e => e.ToTable("custom_profile_fields"));
        b.Entity<UserCustomValue>(e =>
        {
            e.ToTable("user_custom_values");
            e.HasKey(x => new { x.UserId, x.FieldId });
        });

        // Grade scales
        b.Entity<GradeScale>(e => e.ToTable("grade_scales"));
        b.Entity<GradeScaleValue>(e =>
        {
            e.ToTable("grade_scale_values");
            e.HasOne(x => x.Scale).WithMany(x => x.Values).HasForeignKey(x => x.ScaleId).OnDelete(DeleteBehavior.Cascade);
        });

        // Course
        b.Entity<Course>(e => e.ToTable("courses"));
        b.Entity<CourseTeacher>(e =>
        {
            e.ToTable("course_teachers");
            e.HasKey(x => new { x.CourseId, x.TeacherId });
        });
        b.Entity<CourseStudent>(e =>
        {
            e.ToTable("course_students");
            e.HasKey(x => new { x.CourseId, x.StudentId });
        });

        // Module / Lesson
        b.Entity<Module>(e => e.ToTable("modules"));
        b.Entity<Lesson>(e =>
        {
            e.ToTable("lessons");
            e.Property(x => x.ContentBlocks)
                .HasColumnType("jsonb")
                .HasConversion(JsonDocConverter);
        });

        // Homework
        b.Entity<Homework>(e => e.ToTable("homeworks"));
        b.Entity<HomeworkSubmission>(e =>
        {
            e.ToTable("homework_submissions");
            e.Property(x => x.Status).HasConversion(new EnumToStringConverter<Domain.Enums.HomeworkStatus>());
        });

        // Attendance
        b.Entity<AttendanceAndGrade>(e =>
        {
            e.ToTable("attendance_and_grades");
            e.Property(x => x.Attendance).HasConversion(new EnumToStringConverter<Domain.Enums.AttendanceStatus>());
        });

        // Tests
        b.Entity<Test>(e =>
        {
            e.ToTable("tests");
            e.Property(x => x.Questions)
                .HasColumnType("jsonb")
                .HasConversion(JsonDocConverter);
        });
        b.Entity<TestAttempt>(e =>
        {
            e.ToTable("test_attempts");
            e.Property(x => x.AnswersJson)
                .HasColumnType("jsonb")
                .HasConversion(JsonDocConverter);
        });

        // Payments / Audit
        b.Entity<PaymentTransaction>(e =>
        {
            e.ToTable("payment_transactions");
            e.HasOne(x => x.Student)
             .WithMany()
             .HasForeignKey(x => x.StudentId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Course)
             .WithMany(x => x.Transactions)
             .HasForeignKey(x => x.CourseId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);
        });
        b.Entity<AuditLog>(e => e.ToTable("audit_logs"));

        // Gamification
        b.Entity<Badge>(e => e.ToTable("badges"));
        b.Entity<StudentBadge>(e =>
        {
            e.ToTable("student_badges");
            e.HasKey(x => new { x.StudentId, x.BadgeId });
        });
        b.Entity<StudentStreak>(e =>
        {
            e.ToTable("student_streaks");
            e.HasKey(x => x.StudentId);
            // Explicitly declare FK so EF doesn't create a shadow property
            e.HasOne(x => x.Student)
             .WithMany()
             .HasForeignKey(x => x.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Rooms
        b.Entity<Room>(e =>
        {
            e.ToTable("rooms");
            e.HasOne(x => x.Host).WithMany().HasForeignKey(x => x.HostId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });
        b.Entity<RoomMessage>(e =>
        {
            e.ToTable("room_messages");
            e.Property(x => x.Content).HasColumnName("body"); // init.sql uses 'body'
            e.HasOne(x => x.Room).WithMany(x => x.Messages).HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // Parent–Student
        b.Entity<ParentStudent>(e =>
        {
            e.ToTable("parent_students");
            e.HasKey(x => new { x.ParentId, x.StudentId });
            e.HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        // App notifications
        b.Entity<AppNotification>(e =>
        {
            e.ToTable("app_notifications");
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Schedule
        b.Entity<Schedule>(e =>
        {
            e.ToTable("schedules");
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Teacher).WithMany().HasForeignKey(x => x.TeacherId).OnDelete(DeleteBehavior.Restrict);
        });

        // Course progress
        b.Entity<CourseProgress>(e =>
        {
            e.ToTable("course_progresses");
            e.HasKey(x => new { x.StudentId, x.LessonId });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.Cascade);
        });

        // Groups
        b.Entity<StudentGroup>(e => e.ToTable("student_groups"));
        b.Entity<GroupMember>(e =>
        {
            e.ToTable("group_members");
            e.HasKey(x => new { x.GroupId, x.StudentId });
            e.HasOne(x => x.Group).WithMany(x => x.Members).HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        // Lesson comments
        b.Entity<LessonComment>(e =>
        {
            e.ToTable("lesson_comments");
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ParentComment).WithMany(x => x.Replies).HasForeignKey(x => x.ParentCommentId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
        });

        // Question bank
        b.Entity<QuestionBankItem>(e =>
        {
            e.ToTable("question_bank_items");
            e.Property(x => x.Options).HasColumnType("jsonb").HasConversion(JsonDocConverter);
        });

        // Enrollment requests
        b.Entity<EnrollmentRequest>(e =>
        {
            e.ToTable("enrollment_requests");
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CourseId, x.StudentId });
        });

        // Shop
        b.Entity<ShopItem>(e => e.ToTable("shop_items"));
        b.Entity<ShopPurchase>(e =>
        {
            e.ToTable("shop_purchases");
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Item).WithMany(x => x.Purchases).HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Cascade);
        });

        // Daily quests
        b.Entity<DailyQuest>(e => e.ToTable("daily_quests"));
        b.Entity<StudentDailyQuest>(e =>
        {
            e.ToTable("student_daily_quests");
            e.HasIndex(x => new { x.StudentId, x.QuestId, x.Date }).IsUnique();
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Quest).WithMany(x => x.StudentQuests).HasForeignKey(x => x.QuestId).OnDelete(DeleteBehavior.Cascade);
        });

        // Course reviews — use WithMany(x => x.Reviews) so EF knows about the nav property
        b.Entity<CourseReview>(e =>
        {
            e.ToTable("course_reviews");
            e.HasIndex(x => new { x.CourseId, x.StudentId }).IsUnique();
            e.HasOne(x => x.Course)
             .WithMany(x => x.Reviews)        // ← fixes "CourseId1" shadow FK warning
             .HasForeignKey(x => x.CourseId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Student)
             .WithMany()
             .HasForeignKey(x => x.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Direct messages
        b.Entity<DirectMessage>(e =>
        {
            e.ToTable("direct_messages");
            e.HasOne(x => x.Sender).WithMany().HasForeignKey(x => x.SenderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Receiver).WithMany().HasForeignKey(x => x.ReceiverId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.SenderId, x.ReceiverId });
        });

        // Message reactions
        b.Entity<MessageReaction>(e =>
        {
            e.ToTable("message_reactions");
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.DirectMessage).WithMany().HasForeignKey(x => x.DirectMessageId).IsRequired(false).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RoomMessage).WithMany().HasForeignKey(x => x.RoomMessageId).IsRequired(false).OnDelete(DeleteBehavior.Cascade);
        });

        // Lesson recordings
        b.Entity<LessonRecording>(e =>
        {
            e.ToTable("lesson_recordings");
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Teacher).WithMany().HasForeignKey(x => x.TeacherId).OnDelete(DeleteBehavior.Restrict);
        });

        // App settings (key/value store)
        b.Entity<AppSetting>(e =>
        {
            e.ToTable("app_settings");
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(128);
        });

        // Lesson notes
        b.Entity<LessonNote>(e =>
        {
            e.ToTable("lesson_notes");
            e.HasIndex(x => new { x.StudentId, x.LessonId }).IsUnique();
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.Cascade);
        });

        // Bookmarks
        b.Entity<Bookmark>(e =>
        {
            e.ToTable("bookmarks");
            e.HasIndex(x => new { x.UserId, x.Type, x.RefId }).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Flashcard sets + cards
        b.Entity<FlashcardSet>(e =>
        {
            e.ToTable("flashcard_sets");
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        });
        b.Entity<Flashcard>(e =>
        {
            e.ToTable("flashcards");
            e.HasOne(x => x.Set).WithMany(x => x.Cards).HasForeignKey(x => x.SetId).OnDelete(DeleteBehavior.Cascade);
        });

        // Push subscriptions
        b.Entity<PushSubscription>(e =>
        {
            e.ToTable("push_subscriptions");
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}

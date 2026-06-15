using LTropik.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LTropik.Application.Authorization;

/// <summary>
/// Centralised course-ownership checks. Kept in one place so role/ownership logic
/// does not drift across controllers — the kind of drift that let the homework
/// review queue block admins while every other endpoint allowed them.
/// Admins/managers are unrestricted, so callers should only invoke these when the
/// current user is in the Teacher role.
/// </summary>
public static class CourseAccess
{
    /// <summary>True if the user is assigned as a teacher of the given course.</summary>
    public static Task<bool> TeacherOwnsCourseAsync(
        this IApplicationDbContext db, Guid courseId, Guid userId, CancellationToken ct = default) =>
        db.CourseTeachers.AnyAsync(t => t.CourseId == courseId && t.TeacherId == userId, ct);

    /// <summary>True if the user teaches the course that the given lesson belongs to.</summary>
    public static async Task<bool> TeacherOwnsLessonAsync(
        this IApplicationDbContext db, Guid lessonId, Guid userId, CancellationToken ct = default)
    {
        var courseId = await db.Lessons
            .Where(l => l.Id == lessonId)
            .Select(l => l.Module.CourseId)
            .FirstOrDefaultAsync(ct);

        return courseId != Guid.Empty &&
               await db.CourseTeachers.AnyAsync(t => t.CourseId == courseId && t.TeacherId == userId, ct);
    }
}

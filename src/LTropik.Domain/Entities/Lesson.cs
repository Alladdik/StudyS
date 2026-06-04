using System.Text.Json;

namespace LTropik.Domain.Entities;

public class Lesson
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ModuleId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public JsonDocument ContentBlocks { get; set; } = JsonDocument.Parse("[]");

    public Module Module { get; set; } = null!;
    public ICollection<Homework> Homeworks { get; set; } = [];
    public ICollection<Test> Tests { get; set; } = [];
    public ICollection<AttendanceAndGrade> AttendanceRecords { get; set; } = [];
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LTropik.Infrastructure.Persistence;

/// <summary>
/// Used by "dotnet ef migrations add / update" at design time.
/// Reads connection string from env var LTROPIK_DB or uses a local default.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connStr = Environment.GetEnvironmentVariable("LTROPIK_DB")
            ?? "Host=localhost;Database=ltropikdb;Username=ltropikuser;Password=dev_password";

        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connStr)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new AppDbContext(opts);
    }
}

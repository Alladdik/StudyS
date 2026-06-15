using System.Reflection;
using LTropik.WebAPI.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;

namespace LTropik.WebAPI.Tests;

/// <summary>
/// Guards the project-wide rule: an admin can do everything a teacher can.
/// Every endpoint whose role list allows "Teacher" must also allow "Admin".
/// This test would have caught the homework review queue ([Authorize(Roles="Teacher")])
/// that locked admins out, and prevents that class of drift from recurring.
/// </summary>
public class AuthorizationMatrixTests
{
    private static IEnumerable<Type> Controllers =>
        typeof(HomeworksController).Assembly
            .GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

    private static IEnumerable<MethodInfo> Actions(Type controller) =>
        controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>(inherit: true).Any());

    [Fact]
    public void Reflection_finds_controllers_and_actions()
    {
        Assert.NotEmpty(Controllers);
        Assert.Contains(Controllers, c => c == typeof(HomeworksController));
    }

    [Fact]
    public void Every_teacher_endpoint_also_allows_admin()
    {
        var violations = new List<string>();

        foreach (var controller in Controllers)
        foreach (var action in Actions(controller))
        {
            // All role requirements in scope for this action: class-level + method-level.
            var roleAttrs = controller.GetCustomAttributes<AuthorizeAttribute>(inherit: true)
                .Concat(action.GetCustomAttributes<AuthorizeAttribute>(inherit: true))
                .Where(a => !string.IsNullOrWhiteSpace(a.Roles));

            foreach (var attr in roleAttrs)
            {
                var roles = attr.Roles!
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                var allowsTeacher = roles.Any(r => r.Equals("Teacher", StringComparison.OrdinalIgnoreCase));
                var allowsAdmin   = roles.Any(r => r.Equals("Admin", StringComparison.OrdinalIgnoreCase));

                if (allowsTeacher && !allowsAdmin)
                    violations.Add($"{controller.Name}.{action.Name} → Roles=\"{attr.Roles}\" (allows Teacher but not Admin)");
            }
        }

        Assert.True(violations.Count == 0,
            "Admin must be allowed wherever Teacher is:\n  " + string.Join("\n  ", violations));
    }
}

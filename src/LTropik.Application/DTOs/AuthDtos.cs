using System.ComponentModel.DataAnnotations;

namespace LTropik.Application.DTOs;

public record LoginRequest(
    [property: Required, EmailAddress] string Email,
    [property: Required] string Password);

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    string Role,
    Guid UserId,
    bool Requires2fa = false,
    string? PendingToken = null
);

public record RegisterRequest(
    [property: Required, EmailAddress] string Email,
    [property: Required, MinLength(6)] string Password,
    [property: Required] string FirstName,
    [property: Required] string LastName,
    [property: Required] string Role
);

public record Verify2faRequest(string PendingToken, string Code);

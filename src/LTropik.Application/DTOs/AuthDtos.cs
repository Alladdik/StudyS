using System.ComponentModel.DataAnnotations;

namespace LTropik.Application.DTOs;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    string Role,
    Guid UserId,
    bool Requires2fa = false,
    string? PendingToken = null
);

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    [Required] string FirstName,
    [Required] string LastName,
    [Required] string Role
);

public record Verify2faRequest(string PendingToken, string Code);

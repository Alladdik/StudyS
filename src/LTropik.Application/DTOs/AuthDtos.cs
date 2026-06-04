namespace LTropik.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    string Role,
    Guid UserId,
    bool Requires2fa = false,
    string? PendingToken = null
);

public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string Role
);

public record Verify2faRequest(string PendingToken, string Code);

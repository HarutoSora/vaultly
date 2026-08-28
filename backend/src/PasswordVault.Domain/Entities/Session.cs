namespace PasswordVault.Domain.Entities;

/// <summary>
/// A server-side authenticated session. The session token handed to the
/// client is a high-entropy random value; only its SHA-256 hash is ever
/// persisted, so a database read alone can never yield a usable token
/// (same principle as password storage).
/// </summary>
public class Session
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public Guid? DeviceId { get; set; }

    public required string TokenHash { get; set; }

    public required string IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}

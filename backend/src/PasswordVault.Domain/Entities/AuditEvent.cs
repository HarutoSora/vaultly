using PasswordVault.Domain.Enums;

namespace PasswordVault.Domain.Entities;

/// <summary>
/// A record of something happening to an account. Deliberately metadata-only:
/// never write vault item content, master passwords, derived keys, or
/// session tokens into an audit event — see docs/SECURITY.md.
/// </summary>
public class AuditEvent
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public AuditEventType EventType { get; set; }

    public required string IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

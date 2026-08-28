namespace PasswordVault.Application.Abstractions;

/// <summary>
/// Server-side re-hash of the client-computed login proof (itself an Argon2id
/// output — see docs/cryptography.md). This is defense in depth: even though
/// the raw master password never reaches the server, a database leak still
/// shouldn't hand an attacker something they can use directly.
/// </summary>
public interface IServerPasswordHasher
{
    string Hash(string loginProof);

    bool Verify(string loginProof, string storedHash);
}

/// <summary>Cryptographically secure random tokens/salts — session tokens, email verification tokens, KDF salts.</summary>
public interface ISecureTokenGenerator
{
    /// <summary>Returns a URL-safe random token of at least <paramref name="byteLength"/> bytes of entropy.</summary>
    string GenerateToken(int byteLength = 32);

    /// <summary>Returns a random salt as base64, for a new user's KDF salt.</summary>
    string GenerateSaltBase64(int byteLength = 16);

    string Sha256Hex(string value);
}

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed record EmailMessage(string ToEmail, string Subject, string Body);

/// <summary>
/// Abstraction over outbound email so a real provider (SendGrid, SES, ...)
/// can be plugged in later without touching application logic. The default
/// registered implementation only logs — see docs/architecture.md.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}

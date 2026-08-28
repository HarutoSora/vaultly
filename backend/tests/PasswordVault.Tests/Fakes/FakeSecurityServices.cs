using PasswordVault.Application.Abstractions;

namespace PasswordVault.Tests.Fakes;

/// <summary>Trivial, fast, non-cryptographic stand-in for Argon2ServerPasswordHasher — real Argon2id is tested for real in Security/Argon2ServerPasswordHasherTests.</summary>
public sealed class FakeServerPasswordHasher : IServerPasswordHasher
{
    public string Hash(string loginProof) => "hashed:" + loginProof;

    public bool Verify(string loginProof, string storedHash) => storedHash == "hashed:" + loginProof;
}

public sealed class FakeClock : IClock
{
    public DateTimeOffset UtcNow { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class FakeEmailSender : IEmailSender
{
    public readonly List<EmailMessage> Sent = [];

    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        Sent.Add(message);
        return Task.CompletedTask;
    }
}

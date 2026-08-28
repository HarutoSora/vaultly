namespace PasswordVault.Domain.Entities;

/// <summary>
/// An account. Note what is deliberately absent: there is no plaintext
/// master password field anywhere on this entity, and there never should be.
/// <para/>
/// <see cref="MasterPasswordHash"/> is not the master password, or even a
/// direct hash of it — it is a server-side re-hash (defense in depth) of a
/// client-derived "login proof" that the client computes from the master
/// password via Argon2id. The server can verify a login attempt without ever
/// being able to reconstruct the master password or the vault encryption
/// key. See docs/cryptography.md for the full derivation chain.
/// </summary>
public class User
{
    public Guid Id { get; set; }

    public required string Email { get; set; }

    /// <summary>Lower-cased/trimmed form of <see cref="Email"/>, used for uniqueness lookups.</summary>
    public required string EmailNormalized { get; set; }

    public bool EmailVerified { get; set; }

    public string? EmailVerificationTokenHash { get; set; }

    public DateTimeOffset? EmailVerificationTokenExpiresAt { get; set; }

    /// <summary>Random per-user salt (base64) the client uses when deriving the Key Encryption Key from the master password.</summary>
    public required string KdfSalt { get; set; }

    /// <summary>Argon2id memory cost in KiB, stored per-user so parameters can be upgraded without breaking existing accounts.</summary>
    public int KdfMemoryKib { get; set; }

    public int KdfIterations { get; set; }

    public int KdfParallelism { get; set; }

    /// <summary>Server-side re-hash of the client-computed login proof. Never the master password itself.</summary>
    public required string MasterPasswordHash { get; set; }

    /// <summary>The Vault Encryption Key, encrypted client-side with the Key Encryption Key (AES-256-GCM). Opaque to the server.</summary>
    public required string ProtectedVaultKeyCiphertext { get; set; }

    public required string ProtectedVaultKeyNonce { get; set; }

    public int EncryptionVersion { get; set; } = 1;

    public int FailedLoginAttempts { get; set; }

    public DateTimeOffset? LockedOutUntil { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>EF Core concurrency token — guards against lost updates when two devices race to change the same account.</summary>
    public byte[] RowVersion { get; set; } = [];

    public List<Session> Sessions { get; set; } = [];

    public List<Device> Devices { get; set; } = [];

    public List<VaultItem> VaultItems { get; set; } = [];

    public List<Folder> Folders { get; set; } = [];

    public List<AuditEvent> AuditEvents { get; set; } = [];
}

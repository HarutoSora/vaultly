namespace PasswordVault.Domain.Entities;

/// <summary>
/// Folder names are user content, so they are encrypted client-side like
/// everything else in the vault — the server only ever sees ciphertext.
/// </summary>
public class Folder
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public required string NameCiphertext { get; set; }

    public required string NameNonce { get; set; }

    public int EncryptionVersion { get; set; } = 1;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public List<VaultItem> VaultItems { get; set; } = [];
}

using PasswordVault.Domain.Enums;

namespace PasswordVault.Domain.Entities;

/// <summary>
/// One vault entry (login, secure note, or credit card). All field content
/// (username, password, card number, notes, etc.) lives client-side as a
/// single JSON object that is serialized and AES-256-GCM encrypted before
/// this entity is ever built — <see cref="DataCiphertext"/> is opaque to
/// the server. Only non-sensitive metadata needed for listing/filtering
/// (type, favorite, folder, timestamps) is stored in the clear, matching
/// the same trade-off established password managers make.
/// </summary>
public class VaultItem
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public Guid? FolderId { get; set; }

    public Folder? Folder { get; set; }

    public VaultItemType Type { get; set; }

    public bool Favorite { get; set; }

    /// <summary>Base64 AES-256-GCM ciphertext of the JSON-encoded item fields.</summary>
    public required string DataCiphertext { get; set; }

    public required string DataNonce { get; set; }

    public int EncryptionVersion { get; set; } = 1;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Soft-delete: set when moved to trash, cleared on restore. Null = active.</summary>
    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>EF Core concurrency token — guards against one device silently clobbering another's concurrent edit.</summary>
    public byte[] RowVersion { get; set; } = [];
}

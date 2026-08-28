using PasswordVault.Domain.Enums;

namespace PasswordVault.Application.Vault;

/// <summary>
/// <see cref="DataCiphertext"/>/<see cref="DataNonce"/> are opaque to this
/// entire layer — the server never decrypts, inspects, or validates the
/// content of a vault item, only its non-sensitive metadata.
/// </summary>
public sealed record VaultItemDto(
    Guid Id,
    VaultItemType Type,
    bool Favorite,
    Guid? FolderId,
    string DataCiphertext,
    string DataNonce,
    int EncryptionVersion,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt);

public sealed record CreateVaultItemRequest(
    VaultItemType Type,
    bool Favorite,
    Guid? FolderId,
    string DataCiphertext,
    string DataNonce);

public sealed record UpdateVaultItemRequest(
    bool Favorite,
    Guid? FolderId,
    string DataCiphertext,
    string DataNonce);

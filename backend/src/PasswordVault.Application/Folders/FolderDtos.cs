namespace PasswordVault.Application.Folders;

public sealed record FolderDto(
    Guid Id,
    string NameCiphertext,
    string NameNonce,
    int EncryptionVersion,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateFolderRequest(string NameCiphertext, string NameNonce);

public sealed record UpdateFolderRequest(string NameCiphertext, string NameNonce);

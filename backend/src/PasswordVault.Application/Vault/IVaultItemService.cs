namespace PasswordVault.Application.Vault;

public interface IVaultItemService
{
    Task<List<VaultItemDto>> ListAsync(Guid userId, bool includeTrashed, CancellationToken ct = default);

    Task<VaultItemDto> GetAsync(Guid userId, Guid itemId, CancellationToken ct = default);

    Task<VaultItemDto> CreateAsync(Guid userId, CreateVaultItemRequest request, string ipAddress, CancellationToken ct = default);

    Task<VaultItemDto> UpdateAsync(Guid userId, Guid itemId, UpdateVaultItemRequest request, string ipAddress, CancellationToken ct = default);

    /// <summary>Soft-delete: moves the item to trash. Recoverable via <see cref="RestoreAsync"/>.</summary>
    Task TrashAsync(Guid userId, Guid itemId, string ipAddress, CancellationToken ct = default);

    Task RestoreAsync(Guid userId, Guid itemId, string ipAddress, CancellationToken ct = default);

    /// <summary>Permanently deletes a trashed item. Irreversible.</summary>
    Task PurgeAsync(Guid userId, Guid itemId, CancellationToken ct = default);
}

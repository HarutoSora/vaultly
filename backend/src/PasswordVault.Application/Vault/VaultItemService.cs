using PasswordVault.Application.Abstractions;
using PasswordVault.Application.Common;
using PasswordVault.Domain.Entities;
using PasswordVault.Domain.Enums;

namespace PasswordVault.Application.Vault;

public sealed class VaultItemService(
    IVaultItemRepository items,
    IFolderRepository folders,
    IAuditEventRepository auditEvents,
    IUnitOfWork unitOfWork,
    IClock clock) : IVaultItemService
{
    private const int MaxCiphertextLength = 200_000; // ~200KB per item, generous for a login/note/card, guards against abuse.

    public async Task<List<VaultItemDto>> ListAsync(Guid userId, bool includeTrashed, CancellationToken ct = default)
    {
        var list = await items.ListForUserAsync(userId, includeTrashed, ct);
        return list.Select(ToDto).ToList();
    }

    public async Task<VaultItemDto> GetAsync(Guid userId, Guid itemId, CancellationToken ct = default)
    {
        var item = await items.GetByIdAsync(itemId, userId, ct) ?? throw new NotFoundAppException("Item not found.");
        return ToDto(item);
    }

    public async Task<VaultItemDto> CreateAsync(Guid userId, CreateVaultItemRequest request, string ipAddress, CancellationToken ct = default)
    {
        await ValidateCiphertext(request.DataCiphertext, request.DataNonce);
        await EnsureFolderOwnedByUser(userId, request.FolderId, ct);

        var now = clock.UtcNow;
        var item = new VaultItem
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FolderId = request.FolderId,
            Type = request.Type,
            Favorite = request.Favorite,
            DataCiphertext = request.DataCiphertext,
            DataNonce = request.DataNonce,
            EncryptionVersion = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await items.AddAsync(item, ct);
        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.VaultItemCreated, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(item);
    }

    public async Task<VaultItemDto> UpdateAsync(Guid userId, Guid itemId, UpdateVaultItemRequest request, string ipAddress, CancellationToken ct = default)
    {
        await ValidateCiphertext(request.DataCiphertext, request.DataNonce);
        await EnsureFolderOwnedByUser(userId, request.FolderId, ct);

        var item = await items.GetByIdAsync(itemId, userId, ct) ?? throw new NotFoundAppException("Item not found.");

        item.Favorite = request.Favorite;
        item.FolderId = request.FolderId;
        item.DataCiphertext = request.DataCiphertext;
        item.DataNonce = request.DataNonce;
        item.UpdatedAt = clock.UtcNow;

        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.VaultItemUpdated, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(item);
    }

    public async Task TrashAsync(Guid userId, Guid itemId, string ipAddress, CancellationToken ct = default)
    {
        var item = await items.GetByIdAsync(itemId, userId, ct) ?? throw new NotFoundAppException("Item not found.");
        item.DeletedAt = clock.UtcNow;
        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.VaultItemDeleted, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task RestoreAsync(Guid userId, Guid itemId, string ipAddress, CancellationToken ct = default)
    {
        var item = await items.GetByIdAsync(itemId, userId, ct) ?? throw new NotFoundAppException("Item not found.");
        item.DeletedAt = null;
        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.VaultItemRestored, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task PurgeAsync(Guid userId, Guid itemId, CancellationToken ct = default)
    {
        var item = await items.GetByIdAsync(itemId, userId, ct) ?? throw new NotFoundAppException("Item not found.");
        items.Remove(item);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task EnsureFolderOwnedByUser(Guid userId, Guid? folderId, CancellationToken ct)
    {
        if (folderId is null)
        {
            return;
        }

        var folder = await folders.GetByIdAsync(folderId.Value, userId, ct);
        if (folder is null)
        {
            throw new ValidationAppException("Folder not found.");
        }
    }

    private static Task ValidateCiphertext(string ciphertext, string nonce)
    {
        if (string.IsNullOrWhiteSpace(ciphertext) || string.IsNullOrWhiteSpace(nonce))
        {
            throw new ValidationAppException("Missing encrypted item data.");
        }

        if (ciphertext.Length > MaxCiphertextLength)
        {
            throw new ValidationAppException("Item data too large.");
        }

        return Task.CompletedTask;
    }

    private AuditEvent NewAudit(Guid userId, AuditEventType type, string ipAddress) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        EventType = type,
        IpAddress = ipAddress,
        CreatedAt = clock.UtcNow
    };

    private static VaultItemDto ToDto(VaultItem item) => new(
        item.Id,
        item.Type,
        item.Favorite,
        item.FolderId,
        item.DataCiphertext,
        item.DataNonce,
        item.EncryptionVersion,
        item.CreatedAt,
        item.UpdatedAt,
        item.DeletedAt);
}

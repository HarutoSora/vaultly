using PasswordVault.Application.Abstractions;
using PasswordVault.Application.Common;
using PasswordVault.Domain.Entities;
using PasswordVault.Domain.Enums;

namespace PasswordVault.Application.Folders;

public sealed class FolderService(
    IFolderRepository folders,
    IVaultItemRepository items,
    IAuditEventRepository auditEvents,
    IUnitOfWork unitOfWork,
    IClock clock) : IFolderService
{
    private const int MaxCiphertextLength = 2_000; // folder names are short.

    public async Task<List<FolderDto>> ListAsync(Guid userId, CancellationToken ct = default)
    {
        var list = await folders.ListForUserAsync(userId, ct);
        return list.Select(ToDto).ToList();
    }

    public async Task<FolderDto> CreateAsync(Guid userId, CreateFolderRequest request, string ipAddress, CancellationToken ct = default)
    {
        ValidateCiphertext(request.NameCiphertext, request.NameNonce);

        var now = clock.UtcNow;
        var folder = new Folder
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            NameCiphertext = request.NameCiphertext,
            NameNonce = request.NameNonce,
            EncryptionVersion = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await folders.AddAsync(folder, ct);
        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.FolderCreated, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(folder);
    }

    public async Task<FolderDto> RenameAsync(Guid userId, Guid folderId, UpdateFolderRequest request, string ipAddress, CancellationToken ct = default)
    {
        ValidateCiphertext(request.NameCiphertext, request.NameNonce);

        var folder = await folders.GetByIdAsync(folderId, userId, ct) ?? throw new NotFoundAppException("Folder not found.");
        folder.NameCiphertext = request.NameCiphertext;
        folder.NameNonce = request.NameNonce;
        folder.UpdatedAt = clock.UtcNow;

        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.FolderRenamed, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(folder);
    }

    public async Task DeleteAsync(Guid userId, Guid folderId, string ipAddress, CancellationToken ct = default)
    {
        var folder = await folders.GetByIdAsync(folderId, userId, ct) ?? throw new NotFoundAppException("Folder not found.");

        await items.UnfileFolderAsync(folder.Id, ct);
        folders.Remove(folder);

        await auditEvents.AddAsync(NewAudit(userId, AuditEventType.FolderDeleted, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static void ValidateCiphertext(string ciphertext, string nonce)
    {
        if (string.IsNullOrWhiteSpace(ciphertext) || string.IsNullOrWhiteSpace(nonce))
        {
            throw new ValidationAppException("Missing encrypted folder name.");
        }

        if (ciphertext.Length > MaxCiphertextLength)
        {
            throw new ValidationAppException("Folder name too large.");
        }
    }

    private AuditEvent NewAudit(Guid userId, AuditEventType type, string ipAddress) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        EventType = type,
        IpAddress = ipAddress,
        CreatedAt = clock.UtcNow
    };

    private static FolderDto ToDto(Folder folder) => new(
        folder.Id,
        folder.NameCiphertext,
        folder.NameNonce,
        folder.EncryptionVersion,
        folder.CreatedAt,
        folder.UpdatedAt);
}

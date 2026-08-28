using PasswordVault.Domain.Entities;

namespace PasswordVault.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<User?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken ct = default);

    Task<User?> GetByEmailVerificationTokenHashAsync(string tokenHash, CancellationToken ct = default);

    Task AddAsync(User user, CancellationToken ct = default);
}

public interface ISessionRepository
{
    Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);

    Task AddAsync(Session session, CancellationToken ct = default);

    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default);
}

public interface IDeviceRepository
{
    Task<Device?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task AddAsync(Device device, CancellationToken ct = default);
}

public interface IFolderRepository
{
    Task<Folder?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<List<Folder>> ListForUserAsync(Guid userId, CancellationToken ct = default);

    Task AddAsync(Folder folder, CancellationToken ct = default);

    void Remove(Folder folder);
}

public interface IVaultItemRepository
{
    Task<VaultItem?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<List<VaultItem>> ListForUserAsync(Guid userId, bool includeTrashed, CancellationToken ct = default);

    Task AddAsync(VaultItem item, CancellationToken ct = default);

    void Remove(VaultItem item);

    /// <summary>Clears <c>FolderId</c> on every item in the given folder — used when a folder is deleted so its items become unfiled rather than orphaned.</summary>
    Task UnfileFolderAsync(Guid folderId, CancellationToken ct = default);
}

public interface IAuditEventRepository
{
    Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default);
}

/// <summary>Commits the current unit of work. Kept separate from individual repositories so a single request can touch several aggregates and still save atomically.</summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken ct = default);
}

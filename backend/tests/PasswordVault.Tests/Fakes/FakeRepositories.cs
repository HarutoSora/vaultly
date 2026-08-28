using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Tests.Fakes;

/// <summary>
/// In-memory stand-ins for the repository interfaces, used to unit-test the
/// Application-layer services without a database. Mutating an entity returned
/// by a Get*Async method here is visible on the next Get*Async — same
/// reference-type behavior an EF change-tracked entity gives you — so
/// services don't need special-casing to work against either.
/// </summary>
public sealed class FakeUserRepository : IUserRepository
{
    public readonly List<User> Users = [];

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(Users.FirstOrDefault(u => u.Id == id));

    public Task<User?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken ct = default) =>
        Task.FromResult(Users.FirstOrDefault(u => u.EmailNormalized == normalizedEmail));

    public Task<User?> GetByEmailVerificationTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        Task.FromResult(Users.FirstOrDefault(u => u.EmailVerificationTokenHash == tokenHash));

    public Task AddAsync(User user, CancellationToken ct = default)
    {
        Users.Add(user);
        return Task.CompletedTask;
    }
}

public sealed class FakeSessionRepository : ISessionRepository
{
    public readonly List<Session> Sessions = [];
    private readonly FakeUserRepository _users;

    public FakeSessionRepository(FakeUserRepository users) => _users = users;

    public Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default)
    {
        var session = Sessions.FirstOrDefault(s => s.TokenHash == tokenHash);
        if (session is not null)
        {
            session.User = _users.Users.FirstOrDefault(u => u.Id == session.UserId);
        }

        return Task.FromResult(session);
    }

    public Task AddAsync(Session session, CancellationToken ct = default)
    {
        Sessions.Add(session);
        return Task.CompletedTask;
    }

    public Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var s in Sessions.Where(s => s.UserId == userId && s.RevokedAt is null))
        {
            s.RevokedAt = now;
        }

        return Task.CompletedTask;
    }
}

public sealed class FakeDeviceRepository : IDeviceRepository
{
    public readonly List<Device> Devices = [];

    public Task<Device?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(Devices.FirstOrDefault(d => d.Id == id));

    public Task AddAsync(Device device, CancellationToken ct = default)
    {
        Devices.Add(device);
        return Task.CompletedTask;
    }
}

public sealed class FakeFolderRepository : IFolderRepository
{
    public readonly List<Folder> Folders = [];

    public Task<Folder?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        Task.FromResult(Folders.FirstOrDefault(f => f.Id == id && f.UserId == userId));

    public Task<List<Folder>> ListForUserAsync(Guid userId, CancellationToken ct = default) =>
        Task.FromResult(Folders.Where(f => f.UserId == userId).OrderBy(f => f.CreatedAt).ToList());

    public Task AddAsync(Folder folder, CancellationToken ct = default)
    {
        Folders.Add(folder);
        return Task.CompletedTask;
    }

    public void Remove(Folder folder) => Folders.Remove(folder);
}

public sealed class FakeVaultItemRepository : IVaultItemRepository
{
    public readonly List<VaultItem> Items = [];
    public int UnfileFolderCalls;

    public Task<VaultItem?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        Task.FromResult(Items.FirstOrDefault(i => i.Id == id && i.UserId == userId));

    public Task<List<VaultItem>> ListForUserAsync(Guid userId, bool includeTrashed, CancellationToken ct = default)
    {
        var query = Items.Where(i => i.UserId == userId);
        query = includeTrashed ? query.Where(i => i.DeletedAt != null) : query.Where(i => i.DeletedAt == null);
        return Task.FromResult(query.OrderByDescending(i => i.UpdatedAt).ToList());
    }

    public Task AddAsync(VaultItem item, CancellationToken ct = default)
    {
        Items.Add(item);
        return Task.CompletedTask;
    }

    public void Remove(VaultItem item) => Items.Remove(item);

    public Task UnfileFolderAsync(Guid folderId, CancellationToken ct = default)
    {
        UnfileFolderCalls++;
        foreach (var item in Items.Where(i => i.FolderId == folderId))
        {
            item.FolderId = null;
        }

        return Task.CompletedTask;
    }
}

public sealed class FakeAuditEventRepository : IAuditEventRepository
{
    public readonly List<AuditEvent> Events = [];

    public Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default)
    {
        Events.Add(auditEvent);
        return Task.CompletedTask;
    }
}

public sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveCount;

    public Task SaveChangesAsync(CancellationToken ct = default)
    {
        SaveCount++;
        return Task.CompletedTask;
    }
}

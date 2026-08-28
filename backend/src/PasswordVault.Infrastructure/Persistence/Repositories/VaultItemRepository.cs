using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Repositories;

public class VaultItemRepository(VaultDbContext db) : IVaultItemRepository
{
    public Task<VaultItem?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        db.VaultItems.FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId, ct);

    public Task<List<VaultItem>> ListForUserAsync(Guid userId, bool includeTrashed, CancellationToken ct = default)
    {
        var query = db.VaultItems.AsNoTracking().Where(i => i.UserId == userId);
        query = includeTrashed ? query.Where(i => i.DeletedAt != null) : query.Where(i => i.DeletedAt == null);
        return query.OrderByDescending(i => i.UpdatedAt).ToListAsync(ct);
    }

    public async Task AddAsync(VaultItem item, CancellationToken ct = default) =>
        await db.VaultItems.AddAsync(item, ct);

    public void Remove(VaultItem item) => db.VaultItems.Remove(item);

    public async Task UnfileFolderAsync(Guid folderId, CancellationToken ct = default) =>
        await db.VaultItems
            .Where(i => i.FolderId == folderId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(i => i.FolderId, (Guid?)null), ct);
}

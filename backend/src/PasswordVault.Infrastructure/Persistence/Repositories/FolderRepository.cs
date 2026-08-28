using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Repositories;

public class FolderRepository(VaultDbContext db) : IFolderRepository
{
    public Task<Folder?> GetByIdAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId, ct);

    public Task<List<Folder>> ListForUserAsync(Guid userId, CancellationToken ct = default) =>
        db.Folders.AsNoTracking().Where(f => f.UserId == userId).OrderBy(f => f.CreatedAt).ToListAsync(ct);

    public async Task AddAsync(Folder folder, CancellationToken ct = default) =>
        await db.Folders.AddAsync(folder, ct);

    public void Remove(Folder folder) => db.Folders.Remove(folder);
}

using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Abstractions;
using PasswordVault.Application.Common;

namespace PasswordVault.Infrastructure.Persistence;

public class UnitOfWork(VaultDbContext db) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictAppException("This item was changed elsewhere. Reload and try again.");
        }
    }
}

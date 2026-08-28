using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Repositories;

public class UserRepository(VaultDbContext db) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.EmailNormalized == normalizedEmail, ct);

    public Task<User?> GetByEmailVerificationTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.EmailVerificationTokenHash == tokenHash, ct);

    public async Task AddAsync(User user, CancellationToken ct = default) =>
        await db.Users.AddAsync(user, ct);
}

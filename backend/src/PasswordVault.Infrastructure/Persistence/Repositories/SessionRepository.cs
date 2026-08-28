using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Repositories;

public class SessionRepository(VaultDbContext db) : ISessionRepository
{
    public Task<Session?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        db.Sessions.Include(s => s.User).FirstOrDefaultAsync(s => s.TokenHash == tokenHash, ct);

    public async Task AddAsync(Session session, CancellationToken ct = default) =>
        await db.Sessions.AddAsync(session, ct);

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        await db.Sessions
            .Where(s => s.UserId == userId && s.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(s => s.RevokedAt, now), ct);
    }
}

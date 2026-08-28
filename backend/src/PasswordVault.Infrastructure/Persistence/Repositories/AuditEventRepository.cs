using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Repositories;

public class AuditEventRepository(VaultDbContext db) : IAuditEventRepository
{
    public async Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default) =>
        await db.AuditEvents.AddAsync(auditEvent, ct);
}

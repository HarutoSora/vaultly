using Microsoft.EntityFrameworkCore;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence;

public class VaultDbContext(DbContextOptions<VaultDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Session> Sessions => Set<Session>();

    public DbSet<Device> Devices => Set<Device>();

    public DbSet<Folder> Folders => Set<Folder>();

    public DbSet<VaultItem> VaultItems => Set<VaultItem>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(VaultDbContext).Assembly);
    }
}

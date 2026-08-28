using Microsoft.EntityFrameworkCore;
using PasswordVault.Infrastructure.Persistence;
using Xunit;

namespace PasswordVault.Tests.Persistence;

/// <summary>
/// Spins up a real, throwaway SQL Server database (schema built straight from
/// the current EF model, not the migration history) so a handful of tests can
/// verify behavior fakes can't: DB-enforced unique constraints, cascade
/// deletes, and optimistic-concurrency conflicts. Never touches the dev
/// database (PasswordVaultDb) — this uses its own PasswordVaultDb_Test.
/// </summary>
public class SqlServerFixture : IAsyncLifetime
{
    private const string ConnectionString =
        "Server=localhost;Database=PasswordVaultDb_Test;Trusted_Connection=True;TrustServerCertificate=True;";

    public VaultDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<VaultDbContext>().UseSqlServer(ConnectionString).Options);

    public async Task InitializeAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
    }
}

[CollectionDefinition("SqlServer")]
public class SqlServerCollection : ICollectionFixture<SqlServerFixture>;

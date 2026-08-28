using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Common;
using PasswordVault.Domain.Entities;
using PasswordVault.Domain.Enums;
using PasswordVault.Infrastructure.Persistence;
using Xunit;

namespace PasswordVault.Tests.Persistence;

/// <summary>Behavior that only a real database enforces — not testable against the in-memory fakes used elsewhere.</summary>
[Collection("SqlServer")]
public class EfIntegrationTests(SqlServerFixture fixture)
{
    [Fact]
    public async Task UniqueIndexOnNormalizedEmail_RejectsADuplicateAtTheDatabase()
    {
        await using (var db = fixture.CreateContext())
        {
            db.Users.Add(NewUser("dup@example.com"));
            await db.SaveChangesAsync();
        }

        await using var db2 = fixture.CreateContext();
        db2.Users.Add(NewUser("dup@example.com"));
        await Assert.ThrowsAsync<DbUpdateException>(() => db2.SaveChangesAsync());
    }

    [Fact]
    public async Task DeletingAUser_CascadesToAllOwnedData()
    {
        var userId = Guid.NewGuid();

        await using (var db = fixture.CreateContext())
        {
            var user = NewUser("cascade@example.com", userId);
            db.Users.Add(user);
            db.Sessions.Add(new Session { Id = Guid.NewGuid(), UserId = userId, TokenHash = "th", IpAddress = "127.0.0.1", CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1) });
            db.Folders.Add(new Folder { Id = Guid.NewGuid(), UserId = userId, NameCiphertext = "ct", NameNonce = "n", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            db.VaultItems.Add(new VaultItem { Id = Guid.NewGuid(), UserId = userId, Type = VaultItemType.Login, DataCiphertext = "ct", DataNonce = "n", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            db.AuditEvents.Add(new AuditEvent { Id = Guid.NewGuid(), UserId = userId, EventType = AuditEventType.RegistrationCompleted, IpAddress = "127.0.0.1", CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        await using (var db = fixture.CreateContext())
        {
            var user = await db.Users.SingleAsync(u => u.Id == userId);
            db.Users.Remove(user);
            await db.SaveChangesAsync();
        }

        await using var verify = fixture.CreateContext();
        Assert.False(await verify.Users.AnyAsync(u => u.Id == userId));
        Assert.False(await verify.Sessions.AnyAsync(s => s.UserId == userId));
        Assert.False(await verify.Folders.AnyAsync(f => f.UserId == userId));
        Assert.False(await verify.VaultItems.AnyAsync(i => i.UserId == userId));
        Assert.False(await verify.AuditEvents.AnyAsync(a => a.UserId == userId));
    }

    [Fact]
    public async Task DeletingAFolder_UnfilesItsItems_InsteadOfDeletingThem()
    {
        var userId = Guid.NewGuid();
        var folderId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        await using (var db = fixture.CreateContext())
        {
            db.Users.Add(NewUser("folder-owner@example.com", userId));
            db.Folders.Add(new Folder { Id = folderId, UserId = userId, NameCiphertext = "ct", NameNonce = "n", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            db.VaultItems.Add(new VaultItem { Id = itemId, UserId = userId, FolderId = folderId, Type = VaultItemType.Login, DataCiphertext = "ct", DataNonce = "n", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        await using (var db = fixture.CreateContext())
        {
            // Mirrors what FolderService does: unfile before deleting.
            var item = await db.VaultItems.SingleAsync(i => i.Id == itemId);
            item.FolderId = null;
            var folder = await db.Folders.SingleAsync(f => f.Id == folderId);
            db.Folders.Remove(folder);
            await db.SaveChangesAsync();
        }

        await using var verify = fixture.CreateContext();
        Assert.False(await verify.Folders.AnyAsync(f => f.Id == folderId));
        var survivingItem = await verify.VaultItems.SingleAsync(i => i.Id == itemId);
        Assert.Null(survivingItem.FolderId);
    }

    [Fact]
    public async Task ConcurrentEdits_ToTheSameVaultItem_ThrowsConflict_ViaUnitOfWork()
    {
        var userId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        await using (var db = fixture.CreateContext())
        {
            db.Users.Add(NewUser("racer@example.com", userId));
            db.VaultItems.Add(new VaultItem { Id = itemId, UserId = userId, Type = VaultItemType.Login, DataCiphertext = "v1", DataNonce = "n", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        await using var dbA = fixture.CreateContext();
        await using var dbB = fixture.CreateContext();
        var itemA = await dbA.VaultItems.SingleAsync(i => i.Id == itemId);
        var itemB = await dbB.VaultItems.SingleAsync(i => i.Id == itemId);

        itemA.DataCiphertext = "from-device-a";
        await new UnitOfWork(dbA).SaveChangesAsync(); // succeeds, bumps RowVersion

        itemB.DataCiphertext = "from-device-b"; // still holds the now-stale RowVersion
        await Assert.ThrowsAsync<ConflictAppException>(() => new UnitOfWork(dbB).SaveChangesAsync());
    }

    private static User NewUser(string email, Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Email = email,
        EmailNormalized = email,
        KdfSalt = "salt",
        MasterPasswordHash = "hash",
        ProtectedVaultKeyCiphertext = "ct",
        ProtectedVaultKeyNonce = "nonce",
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
}

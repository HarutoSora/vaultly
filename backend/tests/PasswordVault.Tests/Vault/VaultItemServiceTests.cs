using PasswordVault.Application.Common;
using PasswordVault.Application.Vault;
using PasswordVault.Domain.Entities;
using PasswordVault.Domain.Enums;
using PasswordVault.Tests.Fakes;
using Xunit;

namespace PasswordVault.Tests.Vault;

public class VaultItemServiceTests
{
    private const string IpAddress = "127.0.0.1";

    private sealed record Harness(VaultItemService Service, FakeVaultItemRepository Items, FakeFolderRepository Folders, FakeClock Clock);

    private static Harness Build()
    {
        var items = new FakeVaultItemRepository();
        var folders = new FakeFolderRepository();
        var auditEvents = new FakeAuditEventRepository();
        var unitOfWork = new FakeUnitOfWork();
        var clock = new FakeClock();
        var service = new VaultItemService(items, folders, auditEvents, unitOfWork, clock);
        return new Harness(service, items, folders, clock);
    }

    private static CreateVaultItemRequest ValidCreateRequest(Guid? folderId = null) =>
        new(VaultItemType.Login, Favorite: false, folderId, DataCiphertext: "ct", DataNonce: "nonce");

    [Fact]
    public async Task Create_WithValidData_AddsItemOwnedByUser()
    {
        var h = Build();
        var userId = Guid.NewGuid();

        var dto = await h.Service.CreateAsync(userId, ValidCreateRequest(), IpAddress, CancellationToken.None);

        var stored = Assert.Single(h.Items.Items);
        Assert.Equal(userId, stored.UserId);
        Assert.Equal(dto.Id, stored.Id);
    }

    [Theory]
    [InlineData("", "nonce")]
    [InlineData("ct", "")]
    public async Task Create_WithMissingCiphertextOrNonce_ThrowsValidation(string ciphertext, string nonce)
    {
        var h = Build();
        var request = new CreateVaultItemRequest(VaultItemType.Login, false, null, ciphertext, nonce);

        await Assert.ThrowsAsync<ValidationAppException>(() => h.Service.CreateAsync(Guid.NewGuid(), request, IpAddress, CancellationToken.None));
    }

    [Fact]
    public async Task Create_WithOversizedCiphertext_ThrowsValidation()
    {
        var h = Build();
        var request = ValidCreateRequest() with { DataCiphertext = new string('x', 200_001) };

        await Assert.ThrowsAsync<ValidationAppException>(() => h.Service.CreateAsync(Guid.NewGuid(), request, IpAddress, CancellationToken.None));
    }

    [Fact]
    public async Task Create_WithFolderBelongingToAnotherUser_ThrowsValidation()
    {
        var h = Build();
        var ownerA = Guid.NewGuid();
        var ownerB = Guid.NewGuid();
        var foreignFolder = new Folder { Id = Guid.NewGuid(), UserId = ownerB, NameCiphertext = "n", NameNonce = "n", CreatedAt = h.Clock.UtcNow, UpdatedAt = h.Clock.UtcNow };
        h.Folders.Folders.Add(foreignFolder);

        await Assert.ThrowsAsync<ValidationAppException>(
            () => h.Service.CreateAsync(ownerA, ValidCreateRequest(foreignFolder.Id), IpAddress, CancellationToken.None));
    }

    [Fact]
    public async Task Get_ForAnotherUsersItem_ThrowsNotFound()
    {
        var h = Build();
        var owner = Guid.NewGuid();
        var attacker = Guid.NewGuid();
        var item = await h.Service.CreateAsync(owner, ValidCreateRequest(), IpAddress, CancellationToken.None);

        await Assert.ThrowsAsync<NotFoundAppException>(() => h.Service.GetAsync(attacker, item.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Update_ChangesFavoriteAndCiphertext()
    {
        var h = Build();
        var userId = Guid.NewGuid();
        var created = await h.Service.CreateAsync(userId, ValidCreateRequest(), IpAddress, CancellationToken.None);

        var updated = await h.Service.UpdateAsync(
            userId, created.Id,
            new UpdateVaultItemRequest(Favorite: true, FolderId: null, DataCiphertext: "new-ct", DataNonce: "new-nonce"),
            IpAddress, CancellationToken.None);

        Assert.True(updated.Favorite);
        Assert.Equal("new-ct", updated.DataCiphertext);
    }

    [Fact]
    public async Task Update_ForAnotherUsersItem_ThrowsNotFound()
    {
        var h = Build();
        var owner = Guid.NewGuid();
        var attacker = Guid.NewGuid();
        var item = await h.Service.CreateAsync(owner, ValidCreateRequest(), IpAddress, CancellationToken.None);

        await Assert.ThrowsAsync<NotFoundAppException>(() => h.Service.UpdateAsync(
            attacker, item.Id,
            new UpdateVaultItemRequest(true, null, "ct", "nonce"),
            IpAddress, CancellationToken.None));
    }

    [Fact]
    public async Task TrashAndRestore_RoundTrips_AndListRespectsTrashedFlag()
    {
        var h = Build();
        var userId = Guid.NewGuid();
        var item = await h.Service.CreateAsync(userId, ValidCreateRequest(), IpAddress, CancellationToken.None);

        await h.Service.TrashAsync(userId, item.Id, IpAddress, CancellationToken.None);
        Assert.Empty(await h.Service.ListAsync(userId, includeTrashed: false, CancellationToken.None));
        Assert.Single(await h.Service.ListAsync(userId, includeTrashed: true, CancellationToken.None));

        await h.Service.RestoreAsync(userId, item.Id, IpAddress, CancellationToken.None);
        Assert.Single(await h.Service.ListAsync(userId, includeTrashed: false, CancellationToken.None));
    }

    [Fact]
    public async Task Purge_PermanentlyRemovesTheItem()
    {
        var h = Build();
        var userId = Guid.NewGuid();
        var item = await h.Service.CreateAsync(userId, ValidCreateRequest(), IpAddress, CancellationToken.None);

        await h.Service.PurgeAsync(userId, item.Id, CancellationToken.None);

        Assert.Empty(h.Items.Items);
        await Assert.ThrowsAsync<NotFoundAppException>(() => h.Service.GetAsync(userId, item.Id, CancellationToken.None));
    }
}

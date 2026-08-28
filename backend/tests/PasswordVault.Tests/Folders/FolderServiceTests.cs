using PasswordVault.Application.Common;
using PasswordVault.Application.Folders;
using PasswordVault.Application.Vault;
using PasswordVault.Domain.Enums;
using PasswordVault.Tests.Fakes;
using Xunit;

namespace PasswordVault.Tests.Folders;

public class FolderServiceTests
{
    private const string IpAddress = "127.0.0.1";

    private sealed record Harness(FolderService FolderService, VaultItemService ItemService, FakeFolderRepository Folders, FakeVaultItemRepository Items);

    private static Harness Build()
    {
        var folders = new FakeFolderRepository();
        var items = new FakeVaultItemRepository();
        var auditEvents = new FakeAuditEventRepository();
        var unitOfWork = new FakeUnitOfWork();
        var clock = new FakeClock();

        var folderService = new FolderService(folders, items, auditEvents, unitOfWork, clock);
        var itemService = new VaultItemService(items, folders, auditEvents, unitOfWork, clock);
        return new Harness(folderService, itemService, folders, items);
    }

    [Fact]
    public async Task Create_AddsFolderOwnedByUser()
    {
        var h = Build();
        var userId = Guid.NewGuid();

        var dto = await h.FolderService.CreateAsync(userId, new CreateFolderRequest("ct", "nonce"), IpAddress, CancellationToken.None);

        var stored = Assert.Single(h.Folders.Folders);
        Assert.Equal(userId, stored.UserId);
        Assert.Equal(dto.Id, stored.Id);
    }

    [Fact]
    public async Task Rename_UpdatesCiphertext()
    {
        var h = Build();
        var userId = Guid.NewGuid();
        var folder = await h.FolderService.CreateAsync(userId, new CreateFolderRequest("old", "n1"), IpAddress, CancellationToken.None);

        var renamed = await h.FolderService.RenameAsync(userId, folder.Id, new UpdateFolderRequest("new", "n2"), IpAddress, CancellationToken.None);

        Assert.Equal("new", renamed.NameCiphertext);
    }

    [Fact]
    public async Task Rename_ForAnotherUsersFolder_ThrowsNotFound()
    {
        var h = Build();
        var owner = Guid.NewGuid();
        var attacker = Guid.NewGuid();
        var folder = await h.FolderService.CreateAsync(owner, new CreateFolderRequest("ct", "n"), IpAddress, CancellationToken.None);

        await Assert.ThrowsAsync<NotFoundAppException>(() => h.FolderService.RenameAsync(
            attacker, folder.Id, new UpdateFolderRequest("hacked", "n"), IpAddress, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_UnfilesItsItems_RatherThanDeletingThem()
    {
        var h = Build();
        var userId = Guid.NewGuid();
        var folder = await h.FolderService.CreateAsync(userId, new CreateFolderRequest("ct", "n"), IpAddress, CancellationToken.None);
        var item = await h.ItemService.CreateAsync(
            userId, new CreateVaultItemRequest(VaultItemType.Login, false, folder.Id, "ct", "n"), IpAddress, CancellationToken.None);

        await h.FolderService.DeleteAsync(userId, folder.Id, IpAddress, CancellationToken.None);

        Assert.Empty(h.Folders.Folders);
        var survivingItem = Assert.Single(h.Items.Items);
        Assert.Equal(item.Id, survivingItem.Id);
        Assert.Null(survivingItem.FolderId);
    }
}

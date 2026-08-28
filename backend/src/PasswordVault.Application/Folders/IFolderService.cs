namespace PasswordVault.Application.Folders;

public interface IFolderService
{
    Task<List<FolderDto>> ListAsync(Guid userId, CancellationToken ct = default);

    Task<FolderDto> CreateAsync(Guid userId, CreateFolderRequest request, string ipAddress, CancellationToken ct = default);

    Task<FolderDto> RenameAsync(Guid userId, Guid folderId, UpdateFolderRequest request, string ipAddress, CancellationToken ct = default);

    /// <summary>Deletes the folder. Items inside it are not deleted — they become unfiled.</summary>
    Task DeleteAsync(Guid userId, Guid folderId, string ipAddress, CancellationToken ct = default);
}

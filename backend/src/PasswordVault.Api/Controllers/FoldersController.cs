using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PasswordVault.Api.Auth;
using PasswordVault.Application.Folders;

namespace PasswordVault.Api.Controllers;

[ApiController]
[Route("api/vault/folders")]
[Authorize]
public class FoldersController(IFolderService folderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<FolderDto>>> List(CancellationToken ct) =>
        Ok(await folderService.ListAsync(this.CurrentUserId(), ct));

    [HttpPost]
    public async Task<ActionResult<FolderDto>> Create(CreateFolderRequest request, CancellationToken ct) =>
        Ok(await folderService.CreateAsync(this.CurrentUserId(), request, this.ClientIp(), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FolderDto>> Rename(Guid id, UpdateFolderRequest request, CancellationToken ct) =>
        Ok(await folderService.RenameAsync(this.CurrentUserId(), id, request, this.ClientIp(), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await folderService.DeleteAsync(this.CurrentUserId(), id, this.ClientIp(), ct);
        return NoContent();
    }
}

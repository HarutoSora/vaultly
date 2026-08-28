using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PasswordVault.Api.Auth;
using PasswordVault.Application.Vault;

namespace PasswordVault.Api.Controllers;

[ApiController]
[Route("api/vault/items")]
[Authorize]
public class VaultItemsController(IVaultItemService itemService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<VaultItemDto>>> List([FromQuery] bool trashed, CancellationToken ct) =>
        Ok(await itemService.ListAsync(this.CurrentUserId(), trashed, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<VaultItemDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await itemService.GetAsync(this.CurrentUserId(), id, ct));

    [HttpPost]
    public async Task<ActionResult<VaultItemDto>> Create(CreateVaultItemRequest request, CancellationToken ct)
    {
        var created = await itemService.CreateAsync(this.CurrentUserId(), request, this.ClientIp(), ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<VaultItemDto>> Update(Guid id, UpdateVaultItemRequest request, CancellationToken ct) =>
        Ok(await itemService.UpdateAsync(this.CurrentUserId(), id, request, this.ClientIp(), ct));

    [HttpPost("{id:guid}/trash")]
    public async Task<IActionResult> Trash(Guid id, CancellationToken ct)
    {
        await itemService.TrashAsync(this.CurrentUserId(), id, this.ClientIp(), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
    {
        await itemService.RestoreAsync(this.CurrentUserId(), id, this.ClientIp(), ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Purge(Guid id, CancellationToken ct)
    {
        await itemService.PurgeAsync(this.CurrentUserId(), id, ct);
        return NoContent();
    }
}

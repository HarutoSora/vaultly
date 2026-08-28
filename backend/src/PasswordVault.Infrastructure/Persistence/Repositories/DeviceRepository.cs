using Microsoft.EntityFrameworkCore;
using PasswordVault.Application.Abstractions;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Repositories;

public class DeviceRepository(VaultDbContext db) : IDeviceRepository
{
    public Task<Device?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Devices.FirstOrDefaultAsync(d => d.Id == id, ct);

    public async Task AddAsync(Device device, CancellationToken ct = default) =>
        await db.Devices.AddAsync(device, ct);
}

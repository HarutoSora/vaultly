using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PasswordVault.Application.Abstractions;
using PasswordVault.Application.Auth;
using PasswordVault.Application.Folders;
using PasswordVault.Application.Vault;
using PasswordVault.Infrastructure.Email;
using PasswordVault.Infrastructure.Persistence;
using PasswordVault.Infrastructure.Persistence.Repositories;
using PasswordVault.Infrastructure.Security;

namespace PasswordVault.Infrastructure;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<VaultDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("VaultDatabase")));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ISessionRepository, SessionRepository>();
        services.AddScoped<IDeviceRepository, DeviceRepository>();
        services.AddScoped<IFolderRepository, FolderRepository>();
        services.AddScoped<IVaultItemRepository, VaultItemRepository>();
        services.AddScoped<IAuditEventRepository, AuditEventRepository>();

        services.AddSingleton<IServerPasswordHasher, Argon2ServerPasswordHasher>();
        services.AddSingleton<ISecureTokenGenerator, SecureTokenGenerator>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<IEmailSender, LoggingEmailSender>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IVaultItemService, VaultItemService>();
        services.AddScoped<IFolderService, FolderService>();

        return services;
    }
}

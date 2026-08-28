using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
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

        services.Configure<EmailSettings>(configuration.GetSection("Email"));
        // Only send real email once an SMTP host is actually configured (see
        // docker-compose.yml / .env.example) — otherwise fall back to logging,
        // so the app still works out of the box with no email setup at all.
        if (!string.IsNullOrWhiteSpace(configuration["Email:Host"]))
        {
            services.AddScoped<IEmailSender, SmtpEmailSender>();
        }
        else
        {
            services.AddScoped<IEmailSender, LoggingEmailSender>();
        }

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IVaultItemService, VaultItemService>();
        services.AddScoped<IFolderService, FolderService>();

        return services;
    }
}

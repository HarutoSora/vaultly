using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.Property(u => u.EmailNormalized).HasMaxLength(256).IsRequired();
        builder.HasIndex(u => u.EmailNormalized).IsUnique();

        builder.Property(u => u.EmailVerificationTokenHash).HasMaxLength(64);
        builder.HasIndex(u => u.EmailVerificationTokenHash);

        builder.Property(u => u.KdfSalt).HasMaxLength(64).IsRequired();
        builder.Property(u => u.MasterPasswordHash).HasMaxLength(512).IsRequired();

        builder.Property(u => u.ProtectedVaultKeyCiphertext).HasMaxLength(2000).IsRequired();
        builder.Property(u => u.ProtectedVaultKeyNonce).HasMaxLength(64).IsRequired();

        builder.Property(u => u.RowVersion).IsRowVersion();

        builder.HasMany(u => u.Sessions).WithOne(s => s.User).HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(u => u.Devices).WithOne(d => d.User).HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(u => u.Folders).WithOne(f => f.User).HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(u => u.VaultItems).WithOne(i => i.User).HasForeignKey(i => i.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(u => u.AuditEvents).WithOne(a => a.User).HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

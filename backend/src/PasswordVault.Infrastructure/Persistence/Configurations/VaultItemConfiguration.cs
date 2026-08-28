using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Configurations;

public class VaultItemConfiguration : IEntityTypeConfiguration<VaultItem>
{
    public void Configure(EntityTypeBuilder<VaultItem> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.DataCiphertext).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(i => i.DataNonce).HasMaxLength(64).IsRequired();
        builder.Property(i => i.RowVersion).IsRowVersion();

        // Composite index on (UserId, DeletedAt) covers the two real query shapes:
        // "active items for user" and "trashed items for user".
        builder.HasIndex(i => new { i.UserId, i.DeletedAt });
        builder.HasIndex(i => i.FolderId);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Configurations;

public class FolderConfiguration : IEntityTypeConfiguration<Folder>
{
    public void Configure(EntityTypeBuilder<Folder> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.NameCiphertext).HasMaxLength(2000).IsRequired();
        builder.Property(f => f.NameNonce).HasMaxLength(64).IsRequired();
        builder.HasIndex(f => f.UserId);

        // Not SetNull: combined with VaultItem's own cascade-from-User path, SQL
        // Server rejects that as a multiple-cascade-paths cycle. The application
        // already unfiles a folder's items (VaultItemRepository.UnfileFolderAsync)
        // before deleting it, in the same unit of work, so NoAction is safe here.
        builder.HasMany(f => f.VaultItems)
            .WithOne(i => i.Folder)
            .HasForeignKey(i => i.FolderId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

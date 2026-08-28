using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PasswordVault.Domain.Entities;

namespace PasswordVault.Infrastructure.Persistence.Configurations;

public class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.TokenHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(s => s.TokenHash).IsUnique();
        builder.Property(s => s.IpAddress).HasMaxLength(64).IsRequired();
        builder.Property(s => s.UserAgent).HasMaxLength(512);
        builder.HasIndex(s => s.UserId);
    }
}

public class DeviceConfiguration : IEntityTypeConfiguration<Device>
{
    public void Configure(EntityTypeBuilder<Device> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Name).HasMaxLength(128).IsRequired();
        builder.HasIndex(d => d.UserId);
    }
}

public class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.IpAddress).HasMaxLength(64).IsRequired();
        builder.Property(a => a.UserAgent).HasMaxLength(512);
        builder.HasIndex(a => new { a.UserId, a.CreatedAt });
    }
}

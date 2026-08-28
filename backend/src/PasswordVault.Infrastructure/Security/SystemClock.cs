using PasswordVault.Application.Abstractions;

namespace PasswordVault.Infrastructure.Security;

public class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

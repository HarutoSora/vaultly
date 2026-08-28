namespace PasswordVault.Domain.Entities;

public enum DeviceType
{
    WebVault = 0,
    BrowserExtension = 1
}

public class Device
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public required string Name { get; set; }

    public DeviceType Type { get; set; }

    public DateTimeOffset FirstSeenAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }
}

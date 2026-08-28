namespace PasswordVault.Infrastructure.Email;

/// <summary>Bound from the "Email" configuration section — see appsettings.json and docker-compose.yml. Left with an empty Host, the app falls back to <see cref="LoggingEmailSender"/> instead (see InfrastructureServiceCollectionExtensions).</summary>
public class EmailSettings
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    public string FromAddress { get; set; } = "";
    public string FromName { get; set; } = "Vaultly";
}

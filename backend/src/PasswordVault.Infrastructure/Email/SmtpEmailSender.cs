using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using PasswordVault.Application.Abstractions;

namespace PasswordVault.Infrastructure.Email;

/// <summary>
/// Sends real email over SMTP (configured for Gmail by default — smtp.gmail.com:587
/// with an account App Password, never the account's real password — but works
/// with any standard SMTP provider). Registered instead of <see cref="LoggingEmailSender"/>
/// only when <see cref="EmailSettings.Host"/> is actually configured; see
/// InfrastructureServiceCollectionExtensions.
/// </summary>
public class SmtpEmailSender(IOptions<EmailSettings> settings, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var config = settings.Value;

        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(config.FromName, config.FromAddress));
        mime.To.Add(MailboxAddress.Parse(message.ToEmail));
        mime.Subject = message.Subject;
        mime.Body = new TextPart("plain") { Text = message.Body };

        using var client = new SmtpClient();
        try
        {
            await client.ConnectAsync(config.Host, config.Port, SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(config.User, config.Password, ct);
            await client.SendAsync(mime, ct);
        }
        finally
        {
            if (client.IsConnected)
            {
                await client.DisconnectAsync(true, ct);
            }
        }

        // Confirms delivery was attempted without ever logging the message body/recipient content beyond the address itself.
        logger.LogInformation("Sent email to {ToEmail} via {Host}", message.ToEmail, config.Host);
    }
}

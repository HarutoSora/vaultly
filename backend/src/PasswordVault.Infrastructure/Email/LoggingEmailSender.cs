using Microsoft.Extensions.Logging;
using PasswordVault.Application.Abstractions;

namespace PasswordVault.Infrastructure.Email;

/// <summary>
/// Default email sender: logs the message instead of delivering it. This is
/// intentional for the MVP — there is no real mail provider wired up yet.
/// Swap in a real <see cref="IEmailSender"/> implementation (SendGrid, SES,
/// Postmark, ...) behind this same interface when one is chosen; nothing
/// in Application needs to change. Never logs anything beyond what would be
/// safe to put in an email in the first place — no session tokens, no vault data.
/// </summary>
public class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[DEV EMAIL] To: {To} | Subject: {Subject}\n{Body}",
            message.ToEmail, message.Subject, message.Body);
        return Task.CompletedTask;
    }
}

using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using PasswordVault.Application.Auth;

namespace PasswordVault.Api.Auth;

public static class SessionCookieDefaults
{
    public const string Scheme = "SessionCookie";
    public const string CookieName = "pv_session";
}

public class SessionCookieAuthOptions : AuthenticationSchemeOptions;

/// <summary>
/// Reads the <see cref="SessionCookieDefaults.CookieName"/> cookie and resolves
/// it to a user via <see cref="IAuthService.ValidateSessionAsync"/>, which only
/// ever compares a SHA-256 hash of the token against what's stored — the raw
/// token that sits in the cookie is never itself persisted anywhere.
/// </summary>
public class SessionCookieAuthHandler(
    IOptionsMonitor<SessionCookieAuthOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAuthService authService)
    : AuthenticationHandler<SessionCookieAuthOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(SessionCookieDefaults.CookieName, out var token) || string.IsNullOrWhiteSpace(token))
        {
            return AuthenticateResult.NoResult();
        }

        var sessionUser = await authService.ValidateSessionAsync(token, Context.RequestAborted);
        if (sessionUser is null)
        {
            return AuthenticateResult.NoResult();
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, sessionUser.UserId.ToString()),
            new Claim(ClaimTypes.Email, sessionUser.Email)
        };
        var identity = new ClaimsIdentity(claims, SessionCookieDefaults.Scheme);
        var principal = new ClaimsPrincipal(identity);
        return AuthenticateResult.Success(new AuthenticationTicket(principal, SessionCookieDefaults.Scheme));
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PasswordVault.Api.Auth;
using PasswordVault.Api.Contracts;
using PasswordVault.Application.Auth;

namespace PasswordVault.Api.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<RegisterApiResponse>> Register(RegisterApiRequest request, CancellationToken ct)
    {
        var result = await authService.RegisterAsync(new RegisterRequest(
            request.Email,
            request.KdfSalt,
            request.KdfMemoryKib,
            request.KdfIterations,
            request.KdfParallelism,
            request.LoginProof,
            request.ProtectedVaultKeyCiphertext,
            request.ProtectedVaultKeyNonce,
            this.ClientIp()), ct);

        return Ok(new RegisterApiResponse(result.UserId, result.Email));
    }

    [HttpPost("prelogin")]
    public async Task<ActionResult<PreloginApiResponse>> Prelogin(PreloginApiRequest request, CancellationToken ct)
    {
        var result = await authService.GetPreloginParamsAsync(new PreloginRequest(request.Email), ct);
        return Ok(new PreloginApiResponse(result.KdfSalt, result.KdfMemoryKib, result.KdfIterations, result.KdfParallelism));
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailApiRequest request, CancellationToken ct)
    {
        await authService.VerifyEmailAsync(new VerifyEmailRequest(request.Token, this.ClientIp()), ct);
        return NoContent();
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginApiResponse>> Login(LoginApiRequest request, CancellationToken ct)
    {
        var result = await authService.LoginAsync(new LoginRequest(
            request.Email,
            request.LoginProof,
            request.DeviceName,
            this.ClientIp(),
            Request.Headers.UserAgent.ToString()), ct);

        Response.Cookies.Append(SessionCookieDefaults.CookieName, result.RawSessionToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = result.ExpiresAt,
            Path = "/"
        });

        return Ok(new LoginApiResponse(
            result.UserId,
            result.Email,
            result.ProtectedVaultKeyCiphertext,
            result.ProtectedVaultKeyNonce,
            result.EncryptionVersion));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (Request.Cookies.TryGetValue(SessionCookieDefaults.CookieName, out var token))
        {
            await authService.LogoutAsync(token, this.ClientIp(), ct);
        }

        Response.Cookies.Delete(SessionCookieDefaults.CookieName, new CookieOptions { Path = "/" });
        return NoContent();
    }

    [HttpPost("logout-all")]
    [Authorize]
    public async Task<IActionResult> LogoutAll(CancellationToken ct)
    {
        await authService.LogoutAllAsync(this.CurrentUserId(), ct);
        Response.Cookies.Delete(SessionCookieDefaults.CookieName, new CookieOptions { Path = "/" });
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() =>
        Ok(new { userId = this.CurrentUserId(), email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value });

    [HttpGet("vault-key")]
    [Authorize]
    public async Task<ActionResult<VaultKeyResult>> VaultKey(CancellationToken ct) =>
        Ok(await authService.GetVaultKeyAsync(this.CurrentUserId(), ct));
}

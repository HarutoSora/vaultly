using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using PasswordVault.Application.Common;

namespace PasswordVault.Api.Auth;

public static class ControllerExtensions
{
    public static Guid CurrentUserId(this ControllerBase controller)
    {
        var raw = controller.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (raw is null || !Guid.TryParse(raw, out var id))
        {
            throw new UnauthorizedAppException();
        }

        return id;
    }

    /// <summary>Best-effort client IP for audit logging — not a security boundary on its own. Honors X-Forwarded-For only when <c>UseForwardedHeaders</c> is configured (reverse-proxy deployments).</summary>
    public static string ClientIp(this ControllerBase controller) =>
        controller.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

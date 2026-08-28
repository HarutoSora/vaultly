namespace PasswordVault.Api.Middleware;

/// <summary>Adds baseline security headers to every response. Belt-and-suspenders alongside HSTS (added separately via <c>UseHsts</c>).</summary>
public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

        await next(context);
    }
}

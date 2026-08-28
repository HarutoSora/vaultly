using System.Net;
using Microsoft.AspNetCore.Mvc;
using PasswordVault.Application.Common;

namespace PasswordVault.Api.Middleware;

/// <summary>
/// Translates <see cref="AppException"/> subtypes into the matching HTTP status
/// with a plain ProblemDetails body. Unrecognized exceptions become a generic
/// 500 with no exception detail in the response — stack traces and internal
/// messages never reach the client, only the server log.
/// </summary>
public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            var status = ex switch
            {
                ValidationAppException => HttpStatusCode.BadRequest,
                UnauthorizedAppException => HttpStatusCode.Unauthorized,
                NotFoundAppException => HttpStatusCode.NotFound,
                ConflictAppException => HttpStatusCode.Conflict,
                RateLimitedAppException => HttpStatusCode.TooManyRequests,
                _ => HttpStatusCode.BadRequest
            };

            context.Response.StatusCode = (int)status;
            context.Response.ContentType = "application/problem+json";
            var problem = new ProblemDetails
            {
                Status = (int)status,
                Title = ex.Message
            };
            await context.Response.WriteAsJsonAsync(problem);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/problem+json";
            var problem = new ProblemDetails
            {
                Status = (int)HttpStatusCode.InternalServerError,
                Title = "An unexpected error occurred."
            };
            await context.Response.WriteAsJsonAsync(problem);
        }
    }
}

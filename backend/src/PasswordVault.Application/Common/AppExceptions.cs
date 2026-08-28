namespace PasswordVault.Application.Common;

/// <summary>Base for exceptions the API layer translates into an HTTP response. Messages must never contain secrets.</summary>
public abstract class AppException(string message) : Exception(message);

public sealed class ValidationAppException(string message) : AppException(message);

public sealed class UnauthorizedAppException(string message = "Not authorized.") : AppException(message);

public sealed class NotFoundAppException(string message = "Not found.") : AppException(message);

public sealed class ConflictAppException(string message) : AppException(message);

public sealed class RateLimitedAppException(string message = "Too many attempts. Try again later.") : AppException(message);

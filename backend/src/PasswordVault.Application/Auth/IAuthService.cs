namespace PasswordVault.Application.Auth;

public interface IAuthService
{
    Task<RegisterResult> RegisterAsync(RegisterRequest request, CancellationToken ct = default);

    /// <summary>
    /// Returns the KDF parameters a client should use to derive its key for the given
    /// email — including for emails that don't exist, using a deterministic decoy so this
    /// endpoint can't be used to enumerate registered accounts.
    /// </summary>
    Task<PreloginResult> GetPreloginParamsAsync(PreloginRequest request, CancellationToken ct = default);

    Task VerifyEmailAsync(VerifyEmailRequest request, CancellationToken ct = default);

    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct = default);

    Task LogoutAsync(string rawSessionToken, string ipAddress, CancellationToken ct = default);

    Task LogoutAllAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Resolves a raw session token (as read from the auth cookie) to the authenticated user, or null if invalid/expired/revoked.</summary>
    Task<SessionUser?> ValidateSessionAsync(string rawSessionToken, CancellationToken ct = default);

    /// <summary>Lets an already-authenticated client re-derive its KEK and decrypt its VEK locally (unlocking after a reload/idle-lock) without creating a new session.</summary>
    Task<VaultKeyResult> GetVaultKeyAsync(Guid userId, CancellationToken ct = default);
}

namespace PasswordVault.Api.Contracts;

// Separate from the Application-layer DTOs on purpose: these are the only
// shapes a client is trusted to send/receive. Server-derived context (IP,
// user agent) and secrets that must stay cookie-only (the raw session token)
// never appear here.

public sealed record RegisterApiRequest(
    string Email,
    string KdfSalt,
    int KdfMemoryKib,
    int KdfIterations,
    int KdfParallelism,
    string LoginProof,
    string ProtectedVaultKeyCiphertext,
    string ProtectedVaultKeyNonce);

public sealed record RegisterApiResponse(Guid UserId, string Email);

public sealed record PreloginApiRequest(string Email);

public sealed record PreloginApiResponse(string KdfSalt, int KdfMemoryKib, int KdfIterations, int KdfParallelism);

public sealed record VerifyEmailApiRequest(string Token);

public sealed record LoginApiRequest(string Email, string LoginProof, string? DeviceName);

public sealed record LoginApiResponse(
    Guid UserId,
    string Email,
    string ProtectedVaultKeyCiphertext,
    string ProtectedVaultKeyNonce,
    int EncryptionVersion);

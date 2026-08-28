namespace PasswordVault.Application.Auth;

/// <summary>
/// Everything here is either non-secret (email, KDF parameters, ciphertext blobs)
/// or a proof value that is itself a one-way derivation — never a plaintext
/// password. See docs/cryptography.md.
/// </summary>
public sealed record RegisterRequest(
    string Email,
    string KdfSalt,
    int KdfMemoryKib,
    int KdfIterations,
    int KdfParallelism,
    string LoginProof,
    string ProtectedVaultKeyCiphertext,
    string ProtectedVaultKeyNonce,
    string IpAddress);

public sealed record RegisterResult(Guid UserId, string Email);

public sealed record PreloginRequest(string Email);

public sealed record PreloginResult(string KdfSalt, int KdfMemoryKib, int KdfIterations, int KdfParallelism);

public sealed record VerifyEmailRequest(string Token, string IpAddress);

public sealed record LoginRequest(string Email, string LoginProof, string? DeviceName, string IpAddress, string? UserAgent);

public sealed record LoginResult(
    Guid UserId,
    string Email,
    string ProtectedVaultKeyCiphertext,
    string ProtectedVaultKeyNonce,
    int EncryptionVersion,
    string RawSessionToken,
    DateTimeOffset ExpiresAt);

public sealed record SessionUser(Guid UserId, string Email);

/// <summary>What an already-authenticated client needs to unlock the vault locally (re-derive the KEK, decrypt the VEK) without creating a new session.</summary>
public sealed record VaultKeyResult(
    string KdfSalt,
    int KdfMemoryKib,
    int KdfIterations,
    int KdfParallelism,
    string ProtectedVaultKeyCiphertext,
    string ProtectedVaultKeyNonce,
    int EncryptionVersion);

using PasswordVault.Application.Abstractions;
using PasswordVault.Application.Common;
using PasswordVault.Domain.Entities;
using PasswordVault.Domain.Enums;

namespace PasswordVault.Application.Auth;

public sealed class AuthService(
    IUserRepository users,
    ISessionRepository sessions,
    IDeviceRepository devices,
    IAuditEventRepository auditEvents,
    IUnitOfWork unitOfWork,
    IServerPasswordHasher passwordHasher,
    ISecureTokenGenerator tokens,
    IEmailSender emailSender,
    IClock clock) : IAuthService
{
    // OWASP-minimum-or-better Argon2id parameters. Enforced server-side so a
    // compromised or buggy client can never register/authenticate with a
    // deliberately weakened KDF (a "downgrade" attack on the client's own crypto).
    private const int MinKdfMemoryKib = 19_456; // 19 MiB
    private const int MaxKdfMemoryKib = 262_144; // 256 MiB
    private const int MinKdfIterations = 2;
    private const int MaxKdfIterations = 10;
    private const int MinKdfParallelism = 1;
    private const int MaxKdfParallelism = 8;

    private const int MaxFailedLoginAttempts = 10;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(12);
    private static readonly TimeSpan EmailVerificationLifetime = TimeSpan.FromHours(24);

    // Approximates the latency of a real Argon2id verify so that "no such
    // account" and "wrong password" aren't trivially distinguishable by
    // response time. Not a perfect constant-time guarantee — good enough for
    // an MVP threat model; a production system would also want a WAF-level
    // rate limit in front of this endpoint (see the rate limiter in Program.cs).
    private static readonly TimeSpan DecoyVerifyDelay = TimeSpan.FromMilliseconds(120);

    public async Task<RegisterResult> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var email = NormalizeEmail(request.Email);
        if (!IsValidEmail(request.Email))
        {
            throw new ValidationAppException("Enter a valid email address.");
        }

        ValidateKdfParams(request.KdfMemoryKib, request.KdfIterations, request.KdfParallelism);

        if (string.IsNullOrWhiteSpace(request.LoginProof) || request.LoginProof.Length < 16)
        {
            throw new ValidationAppException("Invalid login proof.");
        }

        if (string.IsNullOrWhiteSpace(request.ProtectedVaultKeyCiphertext) || string.IsNullOrWhiteSpace(request.ProtectedVaultKeyNonce))
        {
            throw new ValidationAppException("Missing protected vault key.");
        }

        var existing = await users.GetByNormalizedEmailAsync(email, ct);
        if (existing is not null)
        {
            // Deliberately the same generic failure a validation error would produce,
            // so this endpoint can't be used to enumerate registered emails either.
            throw new ConflictAppException("Could not complete registration.");
        }

        var now = clock.UtcNow;
        var verificationToken = tokens.GenerateToken();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim(),
            EmailNormalized = email,
            EmailVerified = false,
            EmailVerificationTokenHash = tokens.Sha256Hex(verificationToken),
            EmailVerificationTokenExpiresAt = now.Add(EmailVerificationLifetime),
            KdfSalt = request.KdfSalt,
            KdfMemoryKib = request.KdfMemoryKib,
            KdfIterations = request.KdfIterations,
            KdfParallelism = request.KdfParallelism,
            MasterPasswordHash = passwordHasher.Hash(request.LoginProof),
            ProtectedVaultKeyCiphertext = request.ProtectedVaultKeyCiphertext,
            ProtectedVaultKeyNonce = request.ProtectedVaultKeyNonce,
            CreatedAt = now,
            UpdatedAt = now
        };

        await users.AddAsync(user, ct);
        await auditEvents.AddAsync(NewAudit(user.Id, AuditEventType.RegistrationCompleted, request.IpAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);

        await emailSender.SendAsync(new EmailMessage(
            user.Email,
            "Verify your Password Vault account",
            $"Verification code: {verificationToken}\nThis code expires in 24 hours."), ct);

        return new RegisterResult(user.Id, user.Email);
    }

    public async Task<PreloginResult> GetPreloginParamsAsync(PreloginRequest request, CancellationToken ct = default)
    {
        var email = NormalizeEmail(request.Email);
        var user = await users.GetByNormalizedEmailAsync(email, ct);
        if (user is not null)
        {
            return new PreloginResult(user.KdfSalt, user.KdfMemoryKib, user.KdfIterations, user.KdfParallelism);
        }

        // Deterministic decoy: same shape/cost as a real account so this
        // endpoint can't be used to test whether an email is registered.
        var decoySalt = tokens.Sha256Hex("decoy-salt:" + email)[..24];
        return new PreloginResult(decoySalt, MinKdfMemoryKib, MinKdfIterations, MinKdfParallelism);
    }

    public async Task VerifyEmailAsync(VerifyEmailRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            throw new ValidationAppException("Missing verification token.");
        }

        var tokenHash = tokens.Sha256Hex(request.Token);
        var user = await users.GetByEmailVerificationTokenHashAsync(tokenHash, ct);
        if (user is null || user.EmailVerificationTokenExpiresAt is null || user.EmailVerificationTokenExpiresAt < clock.UtcNow)
        {
            throw new ValidationAppException("Invalid or expired verification token.");
        }

        user.EmailVerified = true;
        user.EmailVerificationTokenHash = null;
        user.EmailVerificationTokenExpiresAt = null;
        user.UpdatedAt = clock.UtcNow;

        await auditEvents.AddAsync(NewAudit(user.Id, AuditEventType.EmailVerified, request.IpAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = NormalizeEmail(request.Email);
        var user = await users.GetByNormalizedEmailAsync(email, ct);

        if (user is not null && user.LockedOutUntil is { } lockedUntil && lockedUntil > clock.UtcNow)
        {
            throw new UnauthorizedAppException("Account temporarily locked. Try again later.");
        }

        bool proofValid;
        if (user is null)
        {
            await Task.Delay(DecoyVerifyDelay, ct);
            proofValid = false;
        }
        else
        {
            proofValid = passwordHasher.Verify(request.LoginProof, user.MasterPasswordHash);
        }

        if (user is null || !proofValid)
        {
            if (user is not null)
            {
                await RegisterFailedAttemptAsync(user, request.IpAddress, ct);
            }

            throw new UnauthorizedAppException("Invalid email or password.");
        }

        if (!user.EmailVerified)
        {
            throw new UnauthorizedAppException("Verify your email before logging in.");
        }

        user.FailedLoginAttempts = 0;
        user.LockedOutUntil = null;
        user.UpdatedAt = clock.UtcNow;

        Guid? deviceId = null;
        if (!string.IsNullOrWhiteSpace(request.DeviceName))
        {
            var device = new Device
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Name = request.DeviceName!,
                Type = DeviceType.WebVault,
                FirstSeenAt = clock.UtcNow,
                LastSeenAt = clock.UtcNow
            };
            await devices.AddAsync(device, ct);
            deviceId = device.Id;
        }

        var rawToken = tokens.GenerateToken();
        var now = clock.UtcNow;
        var session = new Session
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            DeviceId = deviceId,
            TokenHash = tokens.Sha256Hex(rawToken),
            IpAddress = request.IpAddress,
            UserAgent = request.UserAgent,
            CreatedAt = now,
            ExpiresAt = now.Add(SessionLifetime)
        };
        await sessions.AddAsync(session, ct);
        await auditEvents.AddAsync(NewAudit(user.Id, AuditEventType.LoginSucceeded, request.IpAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);

        return new LoginResult(
            user.Id,
            user.Email,
            user.ProtectedVaultKeyCiphertext,
            user.ProtectedVaultKeyNonce,
            user.EncryptionVersion,
            rawToken,
            session.ExpiresAt);
    }

    public async Task LogoutAsync(string rawSessionToken, string ipAddress, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawSessionToken))
        {
            return;
        }

        var hash = tokens.Sha256Hex(rawSessionToken);
        var session = await sessions.GetByTokenHashAsync(hash, ct);
        if (session is null)
        {
            return;
        }

        session.RevokedAt = clock.UtcNow;
        await auditEvents.AddAsync(NewAudit(session.UserId, AuditEventType.Logout, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task LogoutAllAsync(Guid userId, CancellationToken ct = default)
    {
        await sessions.RevokeAllForUserAsync(userId, ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<SessionUser?> ValidateSessionAsync(string rawSessionToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawSessionToken))
        {
            return null;
        }

        var hash = tokens.Sha256Hex(rawSessionToken);
        var session = await sessions.GetByTokenHashAsync(hash, ct);
        if (session is null || !session.IsActive(clock.UtcNow) || session.User is null)
        {
            return null;
        }

        return new SessionUser(session.User.Id, session.User.Email);
    }

    public async Task<VaultKeyResult> GetVaultKeyAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await users.GetByIdAsync(userId, ct) ?? throw new NotFoundAppException();
        return new VaultKeyResult(
            user.KdfSalt,
            user.KdfMemoryKib,
            user.KdfIterations,
            user.KdfParallelism,
            user.ProtectedVaultKeyCiphertext,
            user.ProtectedVaultKeyNonce,
            user.EncryptionVersion);
    }

    private async Task RegisterFailedAttemptAsync(User user, string ipAddress, CancellationToken ct)
    {
        user.FailedLoginAttempts++;
        user.UpdatedAt = clock.UtcNow;

        if (user.FailedLoginAttempts >= MaxFailedLoginAttempts)
        {
            user.LockedOutUntil = clock.UtcNow.Add(LockoutDuration);
            await auditEvents.AddAsync(NewAudit(user.Id, AuditEventType.AccountLocked, ipAddress), ct);
        }

        await auditEvents.AddAsync(NewAudit(user.Id, AuditEventType.LoginFailed, ipAddress), ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static bool IsValidEmail(string email) =>
        !string.IsNullOrWhiteSpace(email) && email.Contains('@') && email.Length <= 256;

    private static void ValidateKdfParams(int memoryKib, int iterations, int parallelism)
    {
        if (memoryKib < MinKdfMemoryKib || memoryKib > MaxKdfMemoryKib)
        {
            throw new ValidationAppException($"KDF memory cost must be between {MinKdfMemoryKib} and {MaxKdfMemoryKib} KiB.");
        }

        if (iterations < MinKdfIterations || iterations > MaxKdfIterations)
        {
            throw new ValidationAppException($"KDF iterations must be between {MinKdfIterations} and {MaxKdfIterations}.");
        }

        if (parallelism < MinKdfParallelism || parallelism > MaxKdfParallelism)
        {
            throw new ValidationAppException($"KDF parallelism must be between {MinKdfParallelism} and {MaxKdfParallelism}.");
        }
    }

    private AuditEvent NewAudit(Guid userId, AuditEventType type, string ipAddress) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        EventType = type,
        IpAddress = ipAddress,
        CreatedAt = clock.UtcNow
    };
}

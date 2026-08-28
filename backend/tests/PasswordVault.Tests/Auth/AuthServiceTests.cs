using PasswordVault.Application.Auth;
using PasswordVault.Application.Common;
using PasswordVault.Infrastructure.Security;
using PasswordVault.Tests.Fakes;
using Xunit;

namespace PasswordVault.Tests.Auth;

public class AuthServiceTests
{
    private const string ValidLoginProof = "a-sufficiently-long-login-proof-value";
    private const int ValidMemoryKib = 20_000;
    private const int ValidIterations = 3;
    private const int ValidParallelism = 1;

    private sealed record Harness(
        AuthService Service,
        FakeUserRepository Users,
        FakeSessionRepository Sessions,
        FakeAuditEventRepository AuditEvents,
        FakeEmailSender EmailSender,
        FakeClock Clock);

    private static Harness Build()
    {
        var users = new FakeUserRepository();
        var sessions = new FakeSessionRepository(users);
        var devices = new FakeDeviceRepository();
        var auditEvents = new FakeAuditEventRepository();
        var unitOfWork = new FakeUnitOfWork();
        var hasher = new FakeServerPasswordHasher();
        var tokens = new SecureTokenGenerator();
        var email = new FakeEmailSender();
        var clock = new FakeClock();

        var service = new AuthService(users, sessions, devices, auditEvents, unitOfWork, hasher, tokens, email, clock);
        return new Harness(service, users, sessions, auditEvents, email, clock);
    }

    private static RegisterRequest ValidRegisterRequest(string email = "alice@example.com") => new(
        email,
        KdfSalt: "c2FsdA==",
        KdfMemoryKib: ValidMemoryKib,
        KdfIterations: ValidIterations,
        KdfParallelism: ValidParallelism,
        LoginProof: ValidLoginProof,
        ProtectedVaultKeyCiphertext: "ciphertext",
        ProtectedVaultKeyNonce: "nonce",
        IpAddress: "127.0.0.1");

    private static async Task<Harness> RegisterAndVerifyAsync(string email = "alice@example.com")
    {
        var h = Build();
        await h.Service.RegisterAsync(ValidRegisterRequest(email), CancellationToken.None);
        var user = h.Users.Users.Single();
        // Simulate clicking the emailed link: recover the raw token isn't
        // possible (only its hash is stored), so verify directly via the fake's state.
        user.EmailVerified = true;
        user.EmailVerificationTokenHash = null;
        return h;
    }

    [Fact]
    public async Task Register_WithValidRequest_CreatesUnverifiedUserAndSendsVerificationEmail()
    {
        var h = Build();
        var result = await h.Service.RegisterAsync(ValidRegisterRequest(), CancellationToken.None);

        var user = Assert.Single(h.Users.Users);
        Assert.Equal(result.UserId, user.Id);
        Assert.False(user.EmailVerified);
        Assert.Equal("hashed:" + ValidLoginProof, user.MasterPasswordHash);
        Assert.Single(h.EmailSender.Sent);
    }

    [Theory]
    [InlineData(1000, 3, 1)] // memory too low
    [InlineData(20_000, 1, 1)] // iterations too low
    [InlineData(20_000, 3, 20)] // parallelism too high
    public async Task Register_WithOutOfBoundsKdfParams_ThrowsValidation(int memory, int iterations, int parallelism)
    {
        var h = Build();
        var request = ValidRegisterRequest() with { KdfMemoryKib = memory, KdfIterations = iterations, KdfParallelism = parallelism };

        await Assert.ThrowsAsync<ValidationAppException>(() => h.Service.RegisterAsync(request, CancellationToken.None));
        Assert.Empty(h.Users.Users);
    }

    [Fact]
    public async Task Register_WithAlreadyRegisteredEmail_ThrowsConflict_AndDoesNotRevealWhichEmail()
    {
        var h = await RegisterAndVerifyAsync("bob@example.com");

        var ex = await Assert.ThrowsAsync<ConflictAppException>(
            () => h.Service.RegisterAsync(ValidRegisterRequest("bob@example.com"), CancellationToken.None));

        Assert.DoesNotContain("bob@example.com", ex.Message);
    }

    [Fact]
    public async Task Login_WithCorrectProofOnVerifiedAccount_ReturnsSessionAndVaultKey()
    {
        var h = await RegisterAndVerifyAsync();

        var result = await h.Service.LoginAsync(
            new LoginRequest("alice@example.com", ValidLoginProof, "Test Device", "127.0.0.1", "xUnit"),
            CancellationToken.None);

        Assert.Equal("alice@example.com", result.Email);
        Assert.Equal("ciphertext", result.ProtectedVaultKeyCiphertext);
        Assert.NotEmpty(result.RawSessionToken);
        Assert.Single(h.Sessions.Sessions);
    }

    [Fact]
    public async Task Login_WithWrongProof_ThrowsUnauthorized_AndIncrementsFailedAttempts()
    {
        var h = await RegisterAndVerifyAsync();

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => h.Service.LoginAsync(
            new LoginRequest("alice@example.com", "wrong-proof", null, "127.0.0.1", null), CancellationToken.None));

        Assert.Equal(1, h.Users.Users.Single().FailedLoginAttempts);
        Assert.Empty(h.Sessions.Sessions);
    }

    [Fact]
    public async Task Login_AfterTenFailedAttempts_LocksAccountEvenWithCorrectProof()
    {
        var h = await RegisterAndVerifyAsync();

        for (var i = 0; i < 10; i++)
        {
            await Assert.ThrowsAsync<UnauthorizedAppException>(() => h.Service.LoginAsync(
                new LoginRequest("alice@example.com", "wrong-proof", null, "127.0.0.1", null), CancellationToken.None));
        }

        var user = h.Users.Users.Single();
        Assert.NotNull(user.LockedOutUntil);

        var ex = await Assert.ThrowsAsync<UnauthorizedAppException>(() => h.Service.LoginAsync(
            new LoginRequest("alice@example.com", ValidLoginProof, null, "127.0.0.1", null), CancellationToken.None));
        Assert.Contains("locked", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Login_BeforeEmailVerified_ThrowsUnauthorized()
    {
        var h = Build();
        await h.Service.RegisterAsync(ValidRegisterRequest(), CancellationToken.None);

        var ex = await Assert.ThrowsAsync<UnauthorizedAppException>(() => h.Service.LoginAsync(
            new LoginRequest("alice@example.com", ValidLoginProof, null, "127.0.0.1", null), CancellationToken.None));
        Assert.Contains("verify", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Login_ForNonexistentEmail_ThrowsGenericUnauthorized_SameAsWrongPassword()
    {
        var h = Build();

        var missingEx = await Assert.ThrowsAsync<UnauthorizedAppException>(() => h.Service.LoginAsync(
            new LoginRequest("nobody@example.com", ValidLoginProof, null, "127.0.0.1", null), CancellationToken.None));

        var registered = await RegisterAndVerifyAsync("carol@example.com");
        var wrongPasswordEx = await Assert.ThrowsAsync<UnauthorizedAppException>(() => registered.Service.LoginAsync(
            new LoginRequest("carol@example.com", "wrong", null, "127.0.0.1", null), CancellationToken.None));

        Assert.Equal(missingEx.Message, wrongPasswordEx.Message);
    }

    [Fact]
    public async Task VerifyEmail_WithValidToken_MarksUserVerified()
    {
        var h = Build();
        var capturedToken = string.Empty;
        await h.Service.RegisterAsync(ValidRegisterRequest(), CancellationToken.None);
        // Recover the token the "email" carried, from the fake sender's captured body.
        capturedToken = h.EmailSender.Sent.Single().Body.Split("code: ")[1].Split('\n')[0];

        await h.Service.VerifyEmailAsync(new VerifyEmailRequest(capturedToken, "127.0.0.1"), CancellationToken.None);

        Assert.True(h.Users.Users.Single().EmailVerified);
    }

    [Fact]
    public async Task VerifyEmail_WithGarbageToken_ThrowsValidation()
    {
        var h = Build();
        await h.Service.RegisterAsync(ValidRegisterRequest(), CancellationToken.None);

        await Assert.ThrowsAsync<ValidationAppException>(
            () => h.Service.VerifyEmailAsync(new VerifyEmailRequest("not-a-real-token", "127.0.0.1"), CancellationToken.None));
        Assert.False(h.Users.Users.Single().EmailVerified);
    }

    [Fact]
    public async Task Logout_RevokesTheSpecificSession()
    {
        var h = await RegisterAndVerifyAsync();
        var login = await h.Service.LoginAsync(
            new LoginRequest("alice@example.com", ValidLoginProof, null, "127.0.0.1", null), CancellationToken.None);

        Assert.NotNull(await h.Service.ValidateSessionAsync(login.RawSessionToken, CancellationToken.None));

        await h.Service.LogoutAsync(login.RawSessionToken, "127.0.0.1", CancellationToken.None);

        Assert.Null(await h.Service.ValidateSessionAsync(login.RawSessionToken, CancellationToken.None));
    }

    [Fact]
    public async Task LogoutAll_RevokesEverySessionForTheUser()
    {
        var h = await RegisterAndVerifyAsync();
        var login1 = await h.Service.LoginAsync(
            new LoginRequest("alice@example.com", ValidLoginProof, "Device A", "127.0.0.1", null), CancellationToken.None);
        var login2 = await h.Service.LoginAsync(
            new LoginRequest("alice@example.com", ValidLoginProof, "Device B", "127.0.0.1", null), CancellationToken.None);

        await h.Service.LogoutAllAsync(h.Users.Users.Single().Id, CancellationToken.None);

        Assert.Null(await h.Service.ValidateSessionAsync(login1.RawSessionToken, CancellationToken.None));
        Assert.Null(await h.Service.ValidateSessionAsync(login2.RawSessionToken, CancellationToken.None));
    }

    [Fact]
    public async Task Prelogin_ForRegisteredEmail_ReturnsItsRealKdfParams()
    {
        var h = await RegisterAndVerifyAsync();

        var result = await h.Service.GetPreloginParamsAsync(new PreloginRequest("alice@example.com"), CancellationToken.None);

        Assert.Equal("c2FsdA==", result.KdfSalt);
        Assert.Equal(ValidMemoryKib, result.KdfMemoryKib);
    }

    [Fact]
    public async Task GetVaultKey_ForAuthenticatedUser_ReturnsProtectedKeyAndKdfParams()
    {
        var h = await RegisterAndVerifyAsync();
        var userId = h.Users.Users.Single().Id;

        var result = await h.Service.GetVaultKeyAsync(userId, CancellationToken.None);

        Assert.Equal("ciphertext", result.ProtectedVaultKeyCiphertext);
        Assert.Equal("nonce", result.ProtectedVaultKeyNonce);
        Assert.Equal(ValidMemoryKib, result.KdfMemoryKib);
    }

    [Fact]
    public async Task Prelogin_ForUnknownEmail_ReturnsDeterministicDecoy_NotDistinguishableAsAnEnumerationOracle()
    {
        var h = Build();

        var first = await h.Service.GetPreloginParamsAsync(new PreloginRequest("nobody@example.com"), CancellationToken.None);
        var second = await h.Service.GetPreloginParamsAsync(new PreloginRequest("nobody@example.com"), CancellationToken.None);

        Assert.Equal(first, second); // deterministic per-email, so repeated calls don't leak anything new
    }
}

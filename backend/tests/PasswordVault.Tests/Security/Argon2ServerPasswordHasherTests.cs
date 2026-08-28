using PasswordVault.Infrastructure.Security;
using Xunit;

namespace PasswordVault.Tests.Security;

public class Argon2ServerPasswordHasherTests
{
    [Fact]
    public void Hash_ThenVerify_WithCorrectProof_Succeeds()
    {
        var hasher = new Argon2ServerPasswordHasher();
        var hash = hasher.Hash("correct-login-proof");

        Assert.True(hasher.Verify("correct-login-proof", hash));
    }

    [Fact]
    public void Verify_WithWrongProof_Fails()
    {
        var hasher = new Argon2ServerPasswordHasher();
        var hash = hasher.Hash("correct-login-proof");

        Assert.False(hasher.Verify("wrong-login-proof", hash));
    }

    [Fact]
    public void Hash_ProducesADifferentSaltEachTime_SoTwoHashesOfTheSameProofDiffer()
    {
        var hasher = new Argon2ServerPasswordHasher();

        var hash1 = hasher.Hash("same-proof");
        var hash2 = hasher.Hash("same-proof");

        Assert.NotEqual(hash1, hash2);
        Assert.True(hasher.Verify("same-proof", hash1));
        Assert.True(hasher.Verify("same-proof", hash2));
    }

    [Fact]
    public void Verify_WithMalformedStoredHash_ReturnsFalseInsteadOfThrowing()
    {
        var hasher = new Argon2ServerPasswordHasher();

        Assert.False(hasher.Verify("anything", "not-a-real-hash"));
        Assert.False(hasher.Verify("anything", ""));
    }

    [Fact]
    public void StoredHash_NeverContainsThePlaintextProof()
    {
        var hasher = new Argon2ServerPasswordHasher();
        const string proof = "super-secret-login-proof-value";

        var hash = hasher.Hash(proof);

        Assert.DoesNotContain(proof, hash);
    }
}

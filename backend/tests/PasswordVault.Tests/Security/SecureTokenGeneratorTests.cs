using PasswordVault.Infrastructure.Security;
using Xunit;

namespace PasswordVault.Tests.Security;

public class SecureTokenGeneratorTests
{
    [Fact]
    public void GenerateToken_ProducesUniqueUrlSafeValues()
    {
        var gen = new SecureTokenGenerator();

        var tokens = Enumerable.Range(0, 1000).Select(_ => gen.GenerateToken()).ToList();

        Assert.Equal(tokens.Count, tokens.Distinct().Count());
        Assert.All(tokens, t => Assert.DoesNotContain('+', t));
        Assert.All(tokens, t => Assert.DoesNotContain('/', t));
        Assert.All(tokens, t => Assert.DoesNotContain('=', t));
    }

    [Fact]
    public void Sha256Hex_IsDeterministic_AndDifferentInputsDifferentOutputs()
    {
        var gen = new SecureTokenGenerator();

        Assert.Equal(gen.Sha256Hex("abc"), gen.Sha256Hex("abc"));
        Assert.NotEqual(gen.Sha256Hex("abc"), gen.Sha256Hex("abd"));
        Assert.Equal(64, gen.Sha256Hex("abc").Length); // 32 bytes as hex
    }

    [Fact]
    public void GenerateSaltBase64_ProducesUniqueValuesOfTheRequestedLength()
    {
        var gen = new SecureTokenGenerator();

        var salt1 = gen.GenerateSaltBase64(16);
        var salt2 = gen.GenerateSaltBase64(16);

        Assert.NotEqual(salt1, salt2);
        Assert.Equal(16, Convert.FromBase64String(salt1).Length);
    }
}

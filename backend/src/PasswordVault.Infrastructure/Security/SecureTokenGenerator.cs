using System.Security.Cryptography;
using System.Text;
using PasswordVault.Application.Abstractions;

namespace PasswordVault.Infrastructure.Security;

public class SecureTokenGenerator : ISecureTokenGenerator
{
    public string GenerateToken(int byteLength = 32) =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(byteLength))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_'); // URL-safe

    public string GenerateSaltBase64(int byteLength = 16) =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(byteLength));

    public string Sha256Hex(string value) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

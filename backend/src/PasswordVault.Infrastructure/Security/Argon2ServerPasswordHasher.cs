using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;
using PasswordVault.Application.Abstractions;

namespace PasswordVault.Infrastructure.Security;

/// <summary>
/// Re-hashes the client-computed login proof with server-side Argon2id before
/// storage. This is defense in depth, not the primary KDF: the client already
/// derives the login proof from the master password via Argon2id (see
/// docs/cryptography.md), but that proof's effective entropy is still bounded
/// by the master password itself, so a stolen database should not make
/// brute-forcing weak master passwords any easier than it already is.
/// <para/>
/// Output format is a self-describing PHC-like string so parameters can be
/// upgraded later without breaking existing hashes:
/// <c>argon2id$v=1$m={memoryKib},t={iterations},p={parallelism}${saltBase64}${hashBase64}</c>
/// </summary>
public class Argon2ServerPasswordHasher : IServerPasswordHasher
{
    private const int MemoryKib = 65536; // 64 MiB
    private const int Iterations = 3;
    private const int Parallelism = 2;
    private const int SaltBytes = 16;
    private const int HashBytes = 32;

    public string Hash(string loginProof)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = ComputeHash(loginProof, salt, MemoryKib, Iterations, Parallelism, HashBytes);
        return $"argon2id$v=1$m={MemoryKib},t={Iterations},p={Parallelism}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string loginProof, string storedHash)
    {
        var parts = storedHash.Split('$');
        if (parts.Length != 5 || parts[0] != "argon2id")
        {
            return false;
        }

        var paramsPart = parts[2]; // "m=...,t=...,p=..."
        var paramValues = paramsPart.Split(',')
            .Select(p => p.Split('='))
            .ToDictionary(kv => kv[0], kv => int.Parse(kv[1]));

        if (!paramValues.TryGetValue("m", out var memoryKib) ||
            !paramValues.TryGetValue("t", out var iterations) ||
            !paramValues.TryGetValue("p", out var parallelism))
        {
            return false;
        }

        byte[] salt;
        byte[] expectedHash;
        try
        {
            salt = Convert.FromBase64String(parts[3]);
            expectedHash = Convert.FromBase64String(parts[4]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actualHash = ComputeHash(loginProof, salt, memoryKib, iterations, parallelism, expectedHash.Length);
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static byte[] ComputeHash(string loginProof, byte[] salt, int memoryKib, int iterations, int parallelism, int outputBytes)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(loginProof))
        {
            Salt = salt,
            MemorySize = memoryKib,
            Iterations = iterations,
            DegreeOfParallelism = parallelism
        };

        return argon2.GetBytes(outputBytes);
    }
}

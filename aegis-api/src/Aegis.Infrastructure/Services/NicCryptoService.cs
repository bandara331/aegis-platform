using System.Security.Cryptography;
using System.Text;
using Aegis.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Encrypts Sri Lankan NICs using AES-256-GCM (Security:NicEncryptionKey) and computes
/// a deterministic HMAC-SHA256 index digest (Security:NicHashKey).
/// Never logs or exposes plaintext NICs to AI services.
/// </summary>
public class NicCryptoService : INicCryptoService
{
    private readonly byte[] _encryptionKey;
    private readonly byte[] _hmacKey;

    public NicCryptoService(IConfiguration configuration)
    {
        var rawEncKey = configuration["Security:NicEncryptionKey"];
        var rawHmacKey = configuration["Security:NicHashKey"];

        _encryptionKey = Derive32ByteKey(rawEncKey, "AEGIS_NIC_AES256GCM_DEFAULT_KDF_SALT");
        _hmacKey = Derive32ByteKey(rawHmacKey, "AEGIS_NIC_HMACSHA256_DEFAULT_KDF_SALT");
    }

    public string NormalizeNic(string rawNic)
    {
        if (string.IsNullOrWhiteSpace(rawNic)) return string.Empty;
        return rawNic.Trim().ToUpperInvariant();
    }

    public string EncryptNic(string plainNic)
    {
        var normalized = NormalizeNic(plainNic);
        var plainBytes = Encoding.UTF8.GetBytes(normalized);

        var nonce = RandomNumberGenerator.GetBytes(12); // 96-bit nonce for AES-GCM
        var tag = new byte[16];                         // 128-bit authentication tag
        var cipherBytes = new byte[plainBytes.Length];

        using var aesGcm = new AesGcm(_encryptionKey, 16);
        aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);

        // Layout: [12-byte nonce][16-byte tag][ciphertext]
        var combined = new byte[nonce.Length + tag.Length + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, combined, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipherBytes, 0, combined, nonce.Length + tag.Length, cipherBytes.Length);

        return Convert.ToBase64String(combined);
    }

    public string DecryptNic(string cipherTextBase64)
    {
        var combined = Convert.FromBase64String(cipherTextBase64);
        if (combined.Length < 28)
        {
            throw new CryptographicException("Invalid AES-GCM NIC payload.");
        }

        var nonce = combined.AsSpan(0, 12);
        var tag = combined.AsSpan(12, 16);
        var cipherBytes = combined.AsSpan(28);
        var plainBytes = new byte[cipherBytes.Length];

        using var aesGcm = new AesGcm(_encryptionKey, 16);
        aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }

    public string ComputeNicHmac(string plainNic)
    {
        var normalized = NormalizeNic(plainNic);
        using var hmac = new HMACSHA256(_hmacKey);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexStringLower(hash);
    }

    public string MaskNic(string plainNic)
    {
        var normalized = NormalizeNic(plainNic);
        if (normalized.Length <= 4) return "****";
        var visibleSuffix = normalized[^3..];
        return new string('*', normalized.Length - 3) + visibleSuffix;
    }

    private static byte[] Derive32ByteKey(string? configuredSecret, string domainContext)
    {
        if (!string.IsNullOrWhiteSpace(configuredSecret))
        {
            // Try base64 first if exactly 32 bytes
            try
            {
                var decoded = Convert.FromBase64String(configuredSecret);
                if (decoded.Length == 32) return decoded;
            }
            catch
            {
                // Derive 32-byte key from passphrase via SHA-256
            }
            return SHA256.HashData(Encoding.UTF8.GetBytes($"{domainContext}:{configuredSecret}"));
        }

        return SHA256.HashData(Encoding.UTF8.GetBytes($"{domainContext}:ephemeral-fallback"));
    }
}

using System.Security.Cryptography;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
using Microsoft.Extensions.Hosting;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Validates file extension, MIME type, max size (5 MB), and magic-byte file signature
/// before storing outside wwwroot with a random filename.
/// </summary>
public class LocalFileStorage : IFileStorage
{
    public const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly Dictionary<string, (string[] ContentTypes, byte[][] Signatures)> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = (new[] { "image/jpeg" }, new[] { new byte[] { 0xFF, 0xD8, 0xFF } }),
        [".jpeg"] = (new[] { "image/jpeg" }, new[] { new byte[] { 0xFF, 0xD8, 0xFF } }),
        [".png"] = (new[] { "image/png" }, new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A } }),
        [".pdf"] = (new[] { "application/pdf" }, new[] { new byte[] { 0x25, 0x50, 0x44, 0x46 } }) // %PDF
    };

    private readonly string _storageRoot;

    public LocalFileStorage(IHostEnvironment env)
    {
        // Stored strictly outside wwwroot
        _storageRoot = Path.Combine(env.ContentRootPath, "App_Data", "evidence");
        Directory.CreateDirectory(_storageRoot);
    }

    public LocalFileStorage(string customStorageRoot)
    {
        _storageRoot = customStorageRoot;
        Directory.CreateDirectory(_storageRoot);
    }

    public async Task<Result<(string StoredFileName, string Sha256Hash)>> SaveValidatedFileAsync(
        string originalFileName,
        string contentType,
        Stream contentStream,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(originalFileName))
        {
            return Result<(string, string)>.Failure("Filename is required.");
        }

        var ext = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedTypes.TryGetValue(ext, out var rules))
        {
            return Result<(string, string)>.Failure($"Extension '{ext}' is not permitted. Allowed: .jpg, .jpeg, .png, .pdf.");
        }

        if (!rules.ContentTypes.Any(ct => ct.Equals(contentType, StringComparison.OrdinalIgnoreCase)))
        {
            return Result<(string, string)>.Failure($"Content-Type '{contentType}' does not match extension '{ext}'.");
        }

        using var ms = new MemoryStream();
        await contentStream.CopyToAsync(ms, cancellationToken);
        var bytes = ms.ToArray();

        if (bytes.Length == 0)
        {
            return Result<(string, string)>.Failure("Uploaded file is empty.");
        }

        if (bytes.Length > MaxFileSizeBytes)
        {
            return Result<(string, string)>.Failure("File exceeds the maximum allowed size of 5 MB.");
        }

        // Magic-byte signature check
        var signatureValid = rules.Signatures.Any(sig =>
            bytes.Length >= sig.Length && bytes.AsSpan(0, sig.Length).SequenceEqual(sig));

        if (!signatureValid)
        {
            return Result<(string, string)>.Failure("File binary signature (magic bytes) does not match its declared type.");
        }

        var sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes));
        var storedFileName = $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var fullPath = Path.Combine(_storageRoot, storedFileName);

        await File.WriteAllBytesAsync(fullPath, bytes, cancellationToken);

        return Result<(string, string)>.Success((storedFileName, sha256));
    }
}

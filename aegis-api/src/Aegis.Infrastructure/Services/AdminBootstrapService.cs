using System.Text;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Console bootstrapper for creating the single initial SystemAdmin user.
/// Prompts interactively for the password (never via CLI args, never logged),
/// refuses to run if a SystemAdmin already exists, and records an audit entry.
/// </summary>
public class AdminBootstrapService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IAuditService _auditService;
    private readonly ILogger<AdminBootstrapService> _logger;

    public AdminBootstrapService(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IAuditService auditService,
        ILogger<AdminBootstrapService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<int> ExecuteFromCommandLineAsync(string[] args, CancellationToken ct = default)
    {
        // Reject any attempt to pass password via command-line arguments
        if (args.Any(a => a.StartsWith("--password", StringComparison.OrdinalIgnoreCase) ||
                          a.StartsWith("-p", StringComparison.OrdinalIgnoreCase)))
        {
            Console.Error.WriteLine("ERROR: Do not pass the password as a command-line argument. It will be prompted interactively.");
            return 2;
        }

        string? email = null;
        string fullName = "System Administrator";

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i].Equals("--email", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                email = args[i + 1].Trim();
                i++;
            }
            else if (args[i].Equals("--full-name", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                fullName = args[i + 1].Trim();
                i++;
            }
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            Console.Error.WriteLine("Usage: dotnet run --project src/Aegis.Api -- bootstrap-admin --email <email> [--full-name <name>]");
            return 2;
        }

        // Ensure reference roles exist
        foreach (var role in AegisRoles.All)
        {
            if (!await _roleManager.RoleExistsAsync(role))
            {
                await _roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // Refuse if any SystemAdmin already exists
        var existingAdmins = await _userManager.GetUsersInRoleAsync(AegisRoles.SystemAdmin);
        if (existingAdmins.Count > 0)
        {
            Console.Error.WriteLine("ERROR: A SystemAdmin account already exists. bootstrap-admin can only be executed once on an empty system.");
            return 1;
        }

        Console.Write($"Enter password for initial SystemAdmin ({email}): ");
        var password = ReadSecretLine();
        Console.WriteLine();

        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            Console.Error.WriteLine("ERROR: Password must be at least 8 characters long and include a digit.");
            return 2;
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = fullName,
            PreferredLanguage = "en"
        };

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            var errors = string.Join("; ", createResult.Errors.Select(e => e.Description));
            Console.Error.WriteLine($"ERROR: Failed to create administrator: {errors}");
            return 1;
        }

        await _userManager.AddToRoleAsync(user, AegisRoles.SystemAdmin);

        await _auditService.AppendAsync(
            "User",
            user.Id,
            "BootstrapAdmin",
            user.Id,
            AegisRoles.SystemAdmin,
            new { email = user.Email, role = AegisRoles.SystemAdmin },
            ct);

        _logger.LogInformation("Initial SystemAdmin account bootstrapped with UserId {UserId}", user.Id);
        Console.WriteLine($"SUCCESS: SystemAdmin '{email}' created and sealed in the audit log.");
        return 0;
    }

    private static string ReadSecretLine()
    {
        if (Console.IsInputRedirected)
        {
            return Console.In.ReadLine() ?? string.Empty;
        }

        var sb = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace)
            {
                if (sb.Length > 0) sb.Length--;
            }
            else if (!char.IsControl(key.KeyChar))
            {
                sb.Append(key.KeyChar);
            }
        }
        return sb.ToString();
    }
}

using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using Aegis.Api.Middleware;
using Aegis.Application.Interfaces;
using Aegis.Application.Strategies;
using Aegis.Application.Validators;
using Aegis.Domain.Enums;
using Aegis.Domain.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Aegis.Infrastructure.Identity;
using Aegis.Infrastructure.Persistence;
using Aegis.Infrastructure.Persistence.Repositories;
using Aegis.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// 1. Serilog Setup (Console + Rotating File)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/aegis-api-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// 2. Database Connection (Npgsql with snake_case naming)
var connectionString = builder.Configuration.GetConnectionString("Default");

builder.Services.AddDbContext<AegisDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory", AegisDbContext.SchemaName);
    });
    options.UseSnakeCaseNamingConvention();
});

// 3. Identity Setup
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 8;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
    options.Lockout.MaxFailedAccessAttempts = 5;
})
.AddEntityFrameworkStores<AegisDbContext>()
.AddDefaultTokenProviders();

// 4. Dependency Injection Registrations (Patterns: Repository, UnitOfWork, Observer)
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();
builder.Services.AddScoped<AdminBootstrapService>();

// Application services (all consumed through interfaces: Dependency Injection)
builder.Services.AddSingleton<INicCryptoService, NicCryptoService>();
builder.Services.AddScoped<IAiProvider, RuleBasedAiProvider>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IRequestService, RequestService>();
builder.Services.AddScoped<IDecisionService, DecisionService>();
builder.Services.AddScoped<IKpiService, KpiService>();
builder.Services.AddScoped<IShelterService, ShelterService>();
builder.Services.AddScoped<IResourceService, ResourceService>();
builder.Services.AddScoped<IFileStorage, LocalFileStorage>();

// Strategy Pattern registrations for shortage simulation
builder.Services.AddScoped<IAllocationStrategy, MaxUrgencyStrategy>();
builder.Services.AddScoped<IAllocationStrategy, FairShareStrategy>();
builder.Services.AddScoped<IAllocationStrategy, FastestEtaStrategy>();

// Mapping & Routing integration with Polly standard resilience (timeout, retry, circuit breaker)
builder.Services.AddHttpClient<IRoutingService, OsrmRoutingService>()
    .AddStandardResilienceHandler();

// Email & Outbox integration (SmtpEmailSender via MailKit; marks ServiceHealth email = Down when SMTP unconfigured/failing)
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<INotificationProvider, SmtpEmailSender>();
builder.Services.AddHostedService<NotificationOutboxWorker>();

builder.Services.AddValidatorsFromAssemblyContaining<CreateRequestDtoValidator>();

// JWT authentication (15 minute access tokens)
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.");
builder.Services.AddAuthentication(o =>
    {
        // AddIdentity() registers the cookie scheme as default; this is a pure JWT API, so override it.
        o.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        o.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        o.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(o =>
    {
        // Default inbound claim mapping stays on: "role" -> ClaimTypes.Role, "sub" -> ClaimTypes.NameIdentifier.
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.NameIdentifier,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

// Policy-based authorisation per role
var staffRoles = AegisRoles.All.Where(r => r != AegisRoles.Citizen).ToArray();
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("StaffOnly", p => p.RequireRole(staffRoles));
    o.AddPolicy("CanDecide", p => p.RequireRole(AegisRoles.EmergencyCoordinator, AegisRoles.CaseManager, AegisRoles.LogisticsManager, AegisRoles.SystemAdmin));
    o.AddPolicy("AuditAccess", p => p.RequireRole(AegisRoles.SystemAdmin, AegisRoles.EmergencyCoordinator, AegisRoles.PartnerOfficer));
    o.AddPolicy("AdminOnly", p => p.RequireRole(AegisRoles.SystemAdmin));
});

// Distinct rate limits for citizen login, staff login, OTP verification, and request creation
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("auth", l => { l.PermitLimit = 10; l.Window = TimeSpan.FromMinutes(1); l.QueueLimit = 0; });
    o.AddFixedWindowLimiter("citizen-login", l => { l.PermitLimit = 8; l.Window = TimeSpan.FromMinutes(1); l.QueueLimit = 0; });
    o.AddFixedWindowLimiter("staff-login", l => { l.PermitLimit = 5; l.Window = TimeSpan.FromMinutes(1); l.QueueLimit = 0; });
    o.AddFixedWindowLimiter("otp", l => { l.PermitLimit = 6; l.Window = TimeSpan.FromMinutes(1); l.QueueLimit = 0; });
    o.AddFixedWindowLimiter("requests", l => { l.PermitLimit = 20; l.Window = TimeSpan.FromMinutes(1); l.QueueLimit = 0; });
});

// 5. Controllers & JSON Formatting (camelCase for Next.js frontend contract)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// 6. CORS Configuration
var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:3000";
builder.Services.AddCors(options =>
{
    options.AddPolicy("AegisFrontendPolicy", policy =>
    {
        policy.WithOrigins(frontendOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 7. Swagger / OpenAPI Documentation with JWT Support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "AEGIS Humanitarian Crisis Platform API",
        Version = "v1",
        Description = "ASP.NET Core Web API backend for disaster management, AI advisory, shelter/resource logistics, and cryptographic auditability."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Support CLI command: dotnet run --project src/Aegis.Api -- bootstrap-admin --email <email>
if (args.Length > 0 && args[0].Equals("bootstrap-admin", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var bootstrapper = scope.ServiceProvider.GetRequiredService<AdminBootstrapService>();
    var exitCode = await bootstrapper.ExecuteFromCommandLineAsync(args.Skip(1).ToArray());
    Environment.Exit(exitCode);
    return;
}

// 8. Pipeline Middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "AEGIS API v1");
    });
}

app.UseSerilogRequestLogging();

// Security headers
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    if (!ctx.Request.Path.StartsWithSegments("/swagger"))
    {
        ctx.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    }
    await next();
});

app.UseHttpsRedirection();
app.UseCors("AegisFrontendPolicy");
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health Check Minimal Endpoint
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

app.Run();

// Partial Program class for WebApplicationFactory integration testing
public partial class Program { }

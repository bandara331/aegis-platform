using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Aegis.Infrastructure.Persistence;

public class AegisDbContext : IdentityDbContext<ApplicationUser>
{
    public const string SchemaName = "aegis";

    public AegisDbContext(DbContextOptions<AegisDbContext> options) : base(options)
    {
    }

    public DbSet<Organisation> Organisations => Set<Organisation>();
    public DbSet<Crisis> Crises => Set<Crisis>();
    public DbSet<OperationalArea> OperationalAreas => Set<OperationalArea>();
    public DbSet<AssistanceRequest> AssistanceRequests => Set<AssistanceRequest>();
    public DbSet<RequestHistory> RequestHistories => Set<RequestHistory>();
    public DbSet<RequestEvidence> RequestEvidences => Set<RequestEvidence>();
    public DbSet<AiRecommendation> AiRecommendations => Set<AiRecommendation>();
    public DbSet<Decision> Decisions => Set<Decision>();
    public DbSet<Shelter> Shelters => Set<Shelter>();
    public DbSet<ShelterAllocation> ShelterAllocations => Set<ShelterAllocation>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<ResourceAllocation> ResourceAllocations => Set<ResourceAllocation>();
    public DbSet<Volunteer> Volunteers => Set<Volunteer>();
    public DbSet<VolunteerAssignment> VolunteerAssignments => Set<VolunteerAssignment>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<NotificationOutbox> NotificationOutboxes => Set<NotificationOutbox>();
    public DbSet<AuditLogEntry> AuditLogEntries => Set<AuditLogEntry>();
    public DbSet<AuditChainHead> AuditChainHeads => Set<AuditChainHead>();
    public DbSet<ServiceHealth> ServiceHealths => Set<ServiceHealth>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Province> Provinces => Set<Province>();
    public DbSet<District> Districts => Set<District>();
    public DbSet<RequestCategory> RequestCategories => Set<RequestCategory>();
    public DbSet<EmailOtpChallenge> EmailOtpChallenges => Set<EmailOtpChallenge>();
    public DbSet<StaffInvitation> StaffInvitations => Set<StaffInvitation>();
    public DbSet<OfficialAlert> OfficialAlerts => Set<OfficialAlert>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // All AEGIS tables live in dedicated "aegis" schema
        builder.HasDefaultSchema(SchemaName);

        // Customize Identity table names and unique NIC HMAC index
        builder.Entity<ApplicationUser>(b =>
        {
            b.ToTable("users");
            b.HasIndex(u => u.NicHmac).IsUnique();
        });
        builder.Entity<IdentityRole>(b => b.ToTable("roles"));
        builder.Entity<IdentityUserRole<string>>(b => b.ToTable("user_roles"));
        builder.Entity<IdentityUserClaim<string>>(b => b.ToTable("user_claims"));
        builder.Entity<IdentityUserLogin<string>>(b => b.ToTable("user_logins"));
        builder.Entity<IdentityRoleClaim<string>>(b => b.ToTable("role_claims"));
        builder.Entity<IdentityUserToken<string>>(b => b.ToTable("user_tokens"));

        // Global query filter for soft delete
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                builder.Entity(entityType.ClrType).HasQueryFilter(ConvertFilterExpression(entityType.ClrType));
            }
        }

        // AssistanceRequest
        builder.Entity<AssistanceRequest>(b =>
        {
            b.HasIndex(r => r.TrackingNumber).IsUnique();
            b.HasOne(r => r.DuplicateOf)
                .WithMany()
                .HasForeignKey(r => r.DuplicateOfId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // AiRecommendation
        builder.Entity<AiRecommendation>(b =>
        {
            b.Property(r => r.RationaleJson).HasColumnType("jsonb");
            b.Property(r => r.FeatureScoresJson).HasColumnType("jsonb");
        });

        // AuditLogEntry: details are stored as TEXT (not jsonb) on purpose. jsonb normalises key order and
        // whitespace, which would change the bytes that were hashed and break tamper detection.
        builder.Entity<AuditLogEntry>(b =>
        {
            b.HasIndex(a => a.SequenceNumber).IsUnique();
            b.Property(a => a.DetailsJson).HasColumnType("text");
        });

        // NotificationOutbox
        builder.Entity<NotificationOutbox>(b =>
        {
            b.HasIndex(n => n.IdempotencyKey).IsUnique();
        });

        // IdempotencyRecord
        builder.Entity<IdempotencyRecord>(b =>
        {
            b.HasIndex(i => i.Key).IsUnique();
        });

        // Optimistic concurrency tokens mapped to PostgreSQL xmin system column
        builder.Entity<Shelter>(b =>
        {
            b.Property(s => s.Version).IsRowVersion();
        });

        builder.Entity<Resource>(b =>
        {
            b.Property(r => r.Version).IsRowVersion();
        });

        builder.Entity<Province>(b =>
        {
            b.HasIndex(p => p.Code).IsUnique();
        });

        builder.Entity<District>(b =>
        {
            b.HasIndex(d => d.Name).IsUnique();
        });

        builder.Entity<RequestCategory>(b =>
        {
            b.HasIndex(c => c.Code).IsUnique();
        });

        builder.Entity<EmailOtpChallenge>(b =>
        {
            b.HasIndex(e => new { e.Email, e.Purpose });
        });

        builder.Entity<StaffInvitation>(b =>
        {
            b.HasIndex(s => s.TokenHash).IsUnique();
        });
    }

    private static System.Linq.Expressions.LambdaExpression ConvertFilterExpression(Type entityType)
    {
        var param = System.Linq.Expressions.Expression.Parameter(entityType, "e");
        var prop = System.Linq.Expressions.Expression.Property(param, nameof(BaseEntity.IsDeleted));
        var notDeleted = System.Linq.Expressions.Expression.Equal(prop, System.Linq.Expressions.Expression.Constant(false));
        return System.Linq.Expressions.Expression.Lambda(notDeleted, param);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    break;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}

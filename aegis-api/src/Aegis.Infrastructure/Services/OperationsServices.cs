using Aegis.Application.DTOs;
using Aegis.Application.Interfaces;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;
using Aegis.Domain.Interfaces;
using Aegis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Aegis.Infrastructure.Services;

/// <summary>
/// Concurrency-safe Shelter management service.
/// Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) + xmin optimistic concurrency token.
/// </summary>
public class ShelterService : IShelterService
{
    private readonly AegisDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<ShelterService> _logger;

    public ShelterService(AegisDbContext context, IAuditService auditService, ILogger<ShelterService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ShelterResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var shelters = await _context.Shelters.AsNoTracking().OrderBy(s => s.Name).ToListAsync(cancellationToken);
        return shelters.Select(Map).ToList();
    }

    public async Task<ShelterResponseDto> CreateAsync(CreateShelterDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (dto.Occupancy > dto.Capacity || dto.Capacity <= 0)
        {
            throw new InvalidOperationException("Shelter capacity must be positive and occupancy cannot exceed capacity.");
        }

        var shelter = new Shelter
        {
            Name = dto.Name,
            District = dto.District,
            Capacity = dto.Capacity,
            Occupancy = dto.Occupancy,
            Facilities = dto.Facilities,
            AccessibilityTags = dto.AccessibilityTags,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            ContactPerson = dto.ContactPerson,
            ContactPhone = dto.ContactPhone
        };

        _context.Shelters.Add(shelter);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync("Shelter", shelter.Id.ToString(), "Create", actorId, actorRole,
            new { shelter.Name, shelter.Capacity, shelter.Occupancy }, cancellationToken);

        return Map(shelter);
    }

    public async Task<Result<ShelterResponseDto>> AllocateAsync(
        Guid shelterId,
        AllocateShelterDto dto,
        string actorId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (dto.PersonsCount <= 0)
        {
            return Result<ShelterResponseDto>.Failure("Persons count must be greater than zero.");
        }

        for (int attempt = 1; attempt <= 3; attempt++)
        {
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = null;
            if (_context.Database.IsRelational() && _context.Database.CurrentTransaction == null)
            {
                tx = await _context.Database.BeginTransactionAsync(cancellationToken);
            }

            try
            {
                Shelter? shelter;
                if (_context.Database.IsNpgsql())
                {
                    shelter = await _context.Shelters
                        .FromSqlInterpolated($"SELECT * FROM aegis.shelters WHERE id = {shelterId} AND NOT is_deleted FOR UPDATE")
                        .FirstOrDefaultAsync(cancellationToken);
                }
                else
                {
                    shelter = await _context.Shelters.FirstOrDefaultAsync(s => s.Id == shelterId, cancellationToken);
                }

                if (shelter == null)
                {
                    if (tx != null) await tx.RollbackAsync(cancellationToken);
                    return Result<ShelterResponseDto>.Failure("Shelter not found.");
                }

                if (shelter.Occupancy + dto.PersonsCount > shelter.Capacity)
                {
                    if (tx != null) await tx.RollbackAsync(cancellationToken);
                    return Result<ShelterResponseDto>.Failure(
                        $"Over-allocation blocked: Shelter '{shelter.Name}' has {shelter.Capacity - shelter.Occupancy} available spots, but {dto.PersonsCount} were requested.");
                }

                shelter.Occupancy += dto.PersonsCount;

                var allocation = new ShelterAllocation
                {
                    ShelterId = shelter.Id,
                    RequestId = dto.RequestId,
                    PersonsAllocated = dto.PersonsCount,
                    AllocatedById = actorId,
                    AllocatedAt = DateTime.UtcNow
                };

                _context.ShelterAllocations.Add(allocation);
                await _context.SaveChangesAsync(cancellationToken);

                await _auditService.AppendAsync("Shelter", shelter.Id.ToString(), "Allocate", actorId, actorRole,
                    new { dto.RequestId, dto.PersonsCount, newOccupancy = shelter.Occupancy, shelter.Capacity }, cancellationToken);

                if (tx != null) await tx.CommitAsync(cancellationToken);

                return Result<ShelterResponseDto>.Success(Map(shelter));
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (tx != null) await tx.RollbackAsync(cancellationToken);
                _logger.LogWarning(ex, "Concurrency conflict on shelter {ShelterId} (attempt {Attempt}/3)", shelterId, attempt);
                _context.ChangeTracker.Clear();
                if (attempt == 3)
                {
                    return Result<ShelterResponseDto>.Failure("Concurrent update conflict: shelter occupancy changed during allocation. Please retry.");
                }
            }
            finally
            {
                if (tx != null) await tx.DisposeAsync();
            }
        }

        return Result<ShelterResponseDto>.Failure("Allocation could not be completed due to concurrent modifications.");
    }

    public async Task<Result<ShelterResponseDto>> UpdateOccupancyAsync(
        Guid shelterId,
        int occupancy,
        string? notes,
        string actorId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var shelter = await _context.Shelters.FirstOrDefaultAsync(s => s.Id == shelterId, cancellationToken);
        if (shelter == null) return Result<ShelterResponseDto>.Failure("Shelter not found.");
        if (occupancy < 0) return Result<ShelterResponseDto>.Failure("Occupancy cannot be negative.");
        if (occupancy > shelter.Capacity)
        {
            return Result<ShelterResponseDto>.Failure($"Over-capacity conflict: occupancy ({occupancy}) exceeds shelter capacity ({shelter.Capacity}).");
        }

        var prev = shelter.Occupancy;
        shelter.Occupancy = occupancy;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync("Shelter", shelter.Id.ToString(), "UpdateOccupancy", actorId, actorRole,
            new { shelter.Name, previousOccupancy = prev, newOccupancy = occupancy, shelter.Capacity, notes }, cancellationToken);

        return Result<ShelterResponseDto>.Success(Map(shelter));
    }

    private static ShelterResponseDto Map(Shelter s) => new(
        s.Id,
        s.Name,
        s.District,
        s.Capacity,
        s.Occupancy,
        Math.Max(0, s.Capacity - s.Occupancy),
        s.Facilities,
        s.AccessibilityTags,
        s.Latitude,
        s.Longitude,
        s.ContactPerson,
        s.ContactPhone
    );
}

/// <summary>
/// Concurrency-safe Resource & Logistics dispatch service with location-aware routing.
/// </summary>
public class ResourceService : IResourceService
{
    private readonly AegisDbContext _context;
    private readonly IRoutingService _routingService;
    private readonly IAuditService _auditService;
    private readonly ILogger<ResourceService> _logger;

    public ResourceService(
        AegisDbContext context,
        IRoutingService routingService,
        IAuditService auditService,
        ILogger<ResourceService> logger)
    {
        _context = context;
        _routingService = routingService;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ResourceResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var list = await _context.Resources.AsNoTracking().OrderBy(r => r.ItemName).ToListAsync(cancellationToken);
        return list.Select(r => new ResourceResponseDto(
            r.Id, r.ItemName, r.Category, r.QuantityTotal, r.QuantityAvailable, r.Unit, r.Depot, r.Latitude, r.Longitude
        )).ToList();
    }

    public async Task<ResourceResponseDto> CreateAsync(CreateResourceDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default)
    {
        if (dto.QuantityAvailable < 0 || dto.QuantityTotal < dto.QuantityAvailable)
        {
            throw new InvalidOperationException("Resource quantities must be non-negative and available cannot exceed total.");
        }

        var resource = new Resource
        {
            ItemName = dto.ItemName,
            Category = dto.Category,
            QuantityTotal = dto.QuantityTotal,
            QuantityAvailable = dto.QuantityAvailable,
            Unit = dto.Unit,
            Depot = dto.Depot,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude
        };

        _context.Resources.Add(resource);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.AppendAsync("Resource", resource.Id.ToString(), "Create", actorId, actorRole,
            new { resource.ItemName, resource.Depot, resource.QuantityAvailable }, cancellationToken);

        return new ResourceResponseDto(
            resource.Id, resource.ItemName, resource.Category, resource.QuantityTotal, resource.QuantityAvailable,
            resource.Unit, resource.Depot, resource.Latitude, resource.Longitude);
    }

    public async Task<Result<ResourceDispatchResultDto>> AllocateAsync(
        Guid resourceId,
        AllocateResourceDto dto,
        string actorId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        if (dto.Quantity <= 0)
        {
            return Result<ResourceDispatchResultDto>.Failure("Quantity must be greater than zero.");
        }

        for (int attempt = 1; attempt <= 3; attempt++)
        {
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = null;
            if (_context.Database.IsRelational() && _context.Database.CurrentTransaction == null)
            {
                tx = await _context.Database.BeginTransactionAsync(cancellationToken);
            }

            try
            {
                Resource? resource;
                if (_context.Database.IsNpgsql())
                {
                    resource = await _context.Resources
                        .FromSqlInterpolated($"SELECT * FROM aegis.resources WHERE id = {resourceId} AND NOT is_deleted FOR UPDATE")
                        .FirstOrDefaultAsync(cancellationToken);
                }
                else
                {
                    resource = await _context.Resources.FirstOrDefaultAsync(r => r.Id == resourceId, cancellationToken);
                }

                if (resource == null)
                {
                    if (tx != null) await tx.RollbackAsync(cancellationToken);
                    return Result<ResourceDispatchResultDto>.Failure("Resource not found.");
                }

                if (resource.QuantityAvailable < dto.Quantity)
                {
                    if (tx != null) await tx.RollbackAsync(cancellationToken);
                    return Result<ResourceDispatchResultDto>.Failure(
                        $"Over-allocation blocked: '{resource.ItemName}' at '{resource.Depot}' has only {resource.QuantityAvailable} {resource.Unit} available, but {dto.Quantity} were requested.");
                }

                var request = await _context.AssistanceRequests.FirstOrDefaultAsync(r => r.Id == dto.RequestId, cancellationToken);
                double destLat = request?.Latitude ?? resource.Latitude;
                double destLon = request?.Longitude ?? resource.Longitude;

                var (distKm, etaMin, routeSource) = await _routingService.GetRouteAsync(
                    resource.Latitude, resource.Longitude, destLat, destLon, cancellationToken);

                resource.QuantityAvailable -= dto.Quantity;

                var dispatch = new ResourceAllocation
                {
                    ResourceId = resource.Id,
                    RequestId = dto.RequestId,
                    QuantityDispatched = dto.Quantity,
                    DispatchedById = actorId,
                    Status = "Dispatched",
                    DispatchedAt = DateTime.UtcNow,
                    EstimatedEta = $"{etaMin} mins"
                };

                _context.ResourceAllocations.Add(dispatch);
                await _context.SaveChangesAsync(cancellationToken);

                await _auditService.AppendAsync("Resource", resource.Id.ToString(), "Dispatch", actorId, actorRole,
                    new { dto.RequestId, dto.Quantity, remaining = resource.QuantityAvailable, etaMin, routeSource }, cancellationToken);

                if (tx != null) await tx.CommitAsync(cancellationToken);

                return Result<ResourceDispatchResultDto>.Success(new ResourceDispatchResultDto(
                    dispatch.Id,
                    resource.Id,
                    dto.RequestId,
                    dto.Quantity,
                    resource.QuantityAvailable,
                    distKm,
                    etaMin,
                    routeSource
                ));
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (tx != null) await tx.RollbackAsync(cancellationToken);
                _logger.LogWarning(ex, "Concurrency conflict on resource {ResourceId} (attempt {Attempt}/3)", resourceId, attempt);
                _context.ChangeTracker.Clear();
                if (attempt == 3)
                {
                    return Result<ResourceDispatchResultDto>.Failure("Concurrent update conflict on resource stock. Please retry.");
                }
            }
            finally
            {
                if (tx != null) await tx.DisposeAsync();
            }
        }

        return Result<ResourceDispatchResultDto>.Failure("Resource allocation failed due to concurrent updates.");
    }
}

/// <summary>
/// Duplicate detection using Token-Set Jaccard Similarity + Haversine distance (<= 500m) + 24h window.
/// </summary>
public static class DuplicateDetector
{
    public static DuplicateCandidateDto Evaluate(AssistanceRequest target, AssistanceRequest candidate)
    {
        var jaccard = ComputeTokenJaccard($"{target.Category} {target.Description}", $"{candidate.Category} {candidate.Description}");
        var distMeters = ComputeHaversineMeters(target.Latitude, target.Longitude, candidate.Latitude, candidate.Longitude);
        var hoursApart = Math.Abs((target.CreatedAt - candidate.CreatedAt).TotalHours);

        var isDuplicate = distMeters <= 500.0 && hoursApart <= 24.0 && (jaccard >= 0.25 || target.Category.Equals(candidate.Category, StringComparison.OrdinalIgnoreCase));

        var explanation = isDuplicate
            ? $"Within {distMeters:F0}m (<=500m), {hoursApart:F1}h apart (<=24h), token Jaccard similarity {jaccard:P0}."
            : $"Not a match (distance {distMeters:F0}m, {hoursApart:F1}h apart, Jaccard {jaccard:P0}).";

        return new DuplicateCandidateDto(
            candidate.Id,
            candidate.TrackingNumber,
            Math.Round(jaccard, 2),
            Math.Round(distMeters, 1),
            Math.Round(hoursApart, 1),
            isDuplicate,
            explanation
        );
    }

    public static double ComputeTokenJaccard(string a, string b)
    {
        var separators = new[] { ' ', ',', '.', ';', ':', '-', '/', '\n', '\r', '\t' };
        var setA = a.ToLowerInvariant().Split(separators, StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        var setB = b.ToLowerInvariant().Split(separators, StringSplitOptions.RemoveEmptyEntries).ToHashSet();

        if (setA.Count == 0 && setB.Count == 0) return 1.0;
        if (setA.Count == 0 || setB.Count == 0) return 0.0;

        var intersection = setA.Intersect(setB).Count();
        var union = setA.Union(setB).Count();
        return (double)intersection / union;
    }

    public static double ComputeHaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371000.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return r * (2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a)));
    }
}

using Aegis.Application.DTOs;
using Aegis.Domain.Common;
using Aegis.Domain.Entities;

namespace Aegis.Application.Interfaces;

/// <summary>
/// Strategy Pattern interface for resource shortage allocation algorithms.
/// Pattern: Strategy.
/// </summary>
public interface IAllocationStrategy
{
    string StrategyName { get; }
    IReadOnlyList<ScenarioAllocationItemDto> Allocate(
        IReadOnlyList<AssistanceRequest> competingRequests,
        int availableStock,
        double depotLat,
        double depotLon,
        Func<double, double, double, double, (double DistanceKm, int EtaMinutes)> routeCalculator);
}

/// <summary>
/// Mapping and routing service interface with resilience fallback.
/// </summary>
public interface IRoutingService
{
    Task<(double DistanceKm, int DurationMinutes, string Source)> GetRouteAsync(
        double fromLat,
        double fromLon,
        double toLat,
        double toLon,
        CancellationToken cancellationToken = default);

    (double DistanceKm, int DurationMinutes) CalculateHaversineFallback(
        double fromLat,
        double fromLon,
        double toLat,
        double toLon);
}

/// <summary>
/// Communication provider interface (Console mock by default + MailKit SMTP).
/// </summary>
public interface INotificationProvider
{
    string ProviderName { get; }
    Task<bool> SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken = default);
}

/// <summary>
/// Validated local file storage abstraction outside wwwroot.
/// </summary>
public interface IFileStorage
{
    Task<Result<(string StoredFileName, string Sha256Hash)>> SaveValidatedFileAsync(
        string originalFileName,
        string contentType,
        Stream contentStream,
        CancellationToken cancellationToken = default);
}

public interface IShelterService
{
    Task<IReadOnlyList<ShelterResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<ShelterResponseDto> CreateAsync(CreateShelterDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default);
    Task<Result<ShelterResponseDto>> AllocateAsync(Guid shelterId, AllocateShelterDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default);
}

public interface IResourceService
{
    Task<IReadOnlyList<ResourceResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<ResourceResponseDto> CreateAsync(CreateResourceDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default);
    Task<Result<ResourceDispatchResultDto>> AllocateAsync(Guid resourceId, AllocateResourceDto dto, string actorId, string actorRole, CancellationToken cancellationToken = default);
}

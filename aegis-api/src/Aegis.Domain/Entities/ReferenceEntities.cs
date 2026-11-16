using Aegis.Domain.Common;

namespace Aegis.Domain.Entities;

/// <summary>
/// Reference entity for Sri Lanka's 9 provinces (names only; no demo coordinates).
/// </summary>
public class Province : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Reference entity for Sri Lanka's 25 administrative districts (names only; coordinates come from geocoding).
/// </summary>
public class District : BaseEntity
{
    public string ProvinceCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Reference entity for standard humanitarian assistance request categories.
/// </summary>
public class RequestCategory : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

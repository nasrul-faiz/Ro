// Straight-line (haversine) distance in km between two coordinates. This is
// a fast, client-side approximation used for quick sorting/display (e.g. in
// map location lists) where a full road-distance API call per item would be
// too slow. For route KM figures, prefer getDrivingDistanceKm below.
export function getStraightLineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Fetches real driving/road distance (km) between two points, via the
// server-side /api/route-distance proxy (OSRM). Used for route KM
// calculations so figures reflect actual road travel (car/lorry), not
// straight-line distance.
export async function getDrivingDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      lat1: String(lat1),
      lng1: String(lng1),
      lat2: String(lat2),
      lng2: String(lng2),
    })
    const response = await fetch(`/api/route-distance?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) return null
    const data = await response.json()
    return typeof data.km === "number" ? data.km : null
  } catch (error) {
    console.error("Error fetching driving distance:", error)
    return null
  }
}

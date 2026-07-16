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

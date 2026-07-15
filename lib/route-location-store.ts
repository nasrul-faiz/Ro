export interface RouteLocation {
  id?: number
  routeId: string
  locationCode: string
  locationName?: string
  delivery?: string
}

interface ApiRouteLocation {
  id?: number
  route_id: string
  location_code: string
  location_name?: string
  delivery?: string
}

function fromApi(item: ApiRouteLocation): RouteLocation {
  return {
    id: item.id,
    routeId: item.route_id,
    locationCode: item.location_code,
    locationName: item.location_name,
    delivery: item.delivery,
  }
}

function toApi(item: RouteLocation): ApiRouteLocation {
  return {
    id: item.id,
    route_id: item.routeId,
    location_code: item.locationCode,
  }
}

export async function getRouteLocations(routeId?: string): Promise<RouteLocation[]> {
  try {
    const query = routeId
      ? `?route_id=${encodeURIComponent(routeId)}`
      : ""
    const response = await fetch(`/api/route-locations${query}`, { cache: "no-store" })
    if (!response.ok) throw new Error("Failed to fetch route locations")
    const data: ApiRouteLocation[] = await response.json()
    return data.map(fromApi)
  } catch (error) {
    console.error("Error fetching route locations:", error)
    return []
  }
}

export async function upsertRouteLocations(
  items: RouteLocation[]
): Promise<boolean> {
  try {
    const response = await fetch("/api/route-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items.map(toApi)),
    })
    if (!response.ok) throw new Error("Failed to save route locations")
    return true
  } catch (error) {
    console.error("Error saving route locations:", error)
    return false
  }
}

export async function deleteRouteLocation(
  routeId: string,
  locationCode: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/route-locations?route_id=${encodeURIComponent(routeId)}&location_code=${encodeURIComponent(locationCode)}`,
      { method: "DELETE" }
    )
    if (!response.ok) throw new Error("Failed to delete route location")
    return true
  } catch (error) {
    console.error("Error deleting route location:", error)
    return false
  }
}

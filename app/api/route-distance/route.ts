import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

// Proxies driving-distance requests to the public OSRM routing server so the
// browser doesn't need to call a third-party host directly (avoids CORS/key
// exposure issues). Returns road distance in km, not straight-line distance.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat1 = parseFloat(searchParams.get("lat1") ?? "")
  const lng1 = parseFloat(searchParams.get("lng1") ?? "")
  const lat2 = parseFloat(searchParams.get("lat2") ?? "")
  const lng2 = parseFloat(searchParams.get("lng2") ?? "")

  if ([lat1, lng1, lat2, lng2].some((n) => Number.isNaN(n))) {
    return NextResponse.json(
      { error: "lat1, lng1, lat2 and lng2 query params are required" },
      { status: 400 }
    )
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`
    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      throw new Error(`OSRM request failed with status ${response.status}`)
    }

    const data = await response.json()
    const meters = data?.routes?.[0]?.distance

    if (typeof meters !== "number") {
      return NextResponse.json({ km: null })
    }

    return NextResponse.json({ km: Math.round((meters / 1000) * 100) / 100 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to compute driving distance"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

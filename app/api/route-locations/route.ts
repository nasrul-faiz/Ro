import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery } from "@/lib/db"

export const runtime = "nodejs"

interface RouteLocationRow {
  id?: number
  route_id: string
  location_code: string
  location_name?: string
  delivery?: string
  km?: number
}

async function ensureRouteLocationsTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS route_locations (
      id SERIAL PRIMARY KEY,
      route_id VARCHAR(50) NOT NULL,
      location_code VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(route_id, location_code)
    )
  `)
  await dbQuery(
    "CREATE INDEX IF NOT EXISTS idx_route_locations_route_id ON route_locations(route_id)"
  )
  // Drop old global unique on location_code if it exists
  await dbQuery("DROP INDEX IF EXISTS idx_route_locations_location_code_unique")
  await dbQuery("ALTER TABLE route_locations ADD COLUMN IF NOT EXISTS km NUMERIC(10,2)")
}

export async function GET(request: NextRequest) {
  try {
    await ensureRouteLocationsTable()

    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get("route_id")

    const params: string[] = []
    const where = routeId ? "WHERE rl.route_id = $1" : ""
    if (routeId) params.push(routeId)

    const result = await dbQuery<RouteLocationRow>(
      `SELECT
         rl.id,
         rl.route_id,
         rl.location_code,
         rl.km,
         p.product_name AS location_name,
         COALESCE(p.image, '') AS delivery
       FROM route_locations rl
       LEFT JOIN products p ON p.product_code = rl.location_code
       ${where}
       ORDER BY rl.route_id ASC, rl.location_code ASC`,
      params
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch route locations"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureRouteLocationsTable()

    const payload = await request.json()

    if (!Array.isArray(payload) || payload.length === 0) {
      return NextResponse.json({ error: "Array payload is required" }, { status: 400 })
    }

    const rows: RouteLocationRow[] = []

    for (const item of payload as RouteLocationRow[]) {
      const routeId = item.route_id?.trim()
      const locationCode = item.location_code?.trim().toUpperCase()

      if (!routeId || !locationCode) {
        return NextResponse.json(
          { error: "route_id and location_code are required" },
          { status: 400 }
        )
      }

      const existing = await dbQuery<RouteLocationRow>(
        `SELECT route_id FROM route_locations WHERE location_code = $1`,
        [locationCode]
      )

      if (existing.rows.length > 0 && existing.rows[0].route_id !== routeId) {
        return NextResponse.json(
          { error: `Location ${locationCode} is already assigned to another route` },
          { status: 409 }
        )
      }

      const km = item.km != null ? Number(item.km) : null

      const result = await dbQuery<RouteLocationRow>(
        `INSERT INTO route_locations (route_id, location_code, km)
         VALUES ($1, $2, $3)
         ON CONFLICT (route_id, location_code)
         DO UPDATE SET updated_at = NOW(), km = EXCLUDED.km
         RETURNING id, route_id, location_code, km`,
        [routeId, locationCode, km]
      )

      rows.push(result.rows[0])
    }

    return NextResponse.json(rows, { status: 201 })
  } catch (error) {
    if (
      error instanceof Error &&
      /duplicate key value violates unique constraint/i.test(error.message)
    ) {
      return NextResponse.json(
        { error: "Location is already assigned to another route" },
        { status: 409 }
      )
    }
    const message =
      error instanceof Error ? error.message : "Failed to upsert route locations"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureRouteLocationsTable()

    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get("route_id")
    const locationCode = searchParams.get("location_code")

    if (!routeId || !locationCode) {
      return NextResponse.json(
        { error: "route_id and location_code are required" },
        { status: 400 }
      )
    }

    await dbQuery(
      "DELETE FROM route_locations WHERE route_id = $1 AND location_code = $2",
      [routeId, locationCode]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete route location"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

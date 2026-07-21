import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery } from "@/lib/db"

export const runtime = "nodejs"

interface CustomOrderRow {
  id: number
  route_id: string
  name: string
  created_at: string
}

interface CustomOrderItemRow {
  id: number
  custom_order_id: number
  location_code: string
  sort_order: number
}

async function ensureCustomOrderTables() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS custom_orders (
      id SERIAL PRIMARY KEY,
      route_id VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS custom_order_items (
      id SERIAL PRIMARY KEY,
      custom_order_id INTEGER NOT NULL,
      location_code VARCHAR(100) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (custom_order_id) REFERENCES custom_orders(id) ON DELETE CASCADE
    )
  `)
  await dbQuery(
    "CREATE INDEX IF NOT EXISTS idx_custom_orders_route_id ON custom_orders(route_id)"
  )
  await dbQuery(
    "CREATE INDEX IF NOT EXISTS idx_custom_order_items_custom_order_id ON custom_order_items(custom_order_id)"
  )
}

export async function GET(request: NextRequest) {
  try {
    await ensureCustomOrderTables()

    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get("route_id")

    if (!routeId) {
      return NextResponse.json({ error: "route_id is required" }, { status: 400 })
    }

    const orders = await dbQuery<CustomOrderRow>(
      "SELECT id, route_id, name, created_at FROM custom_orders WHERE route_id = $1 ORDER BY created_at DESC",
      [routeId]
    )

    const items = await dbQuery<CustomOrderItemRow>(
      `SELECT coi.id, coi.custom_order_id, coi.location_code, coi.sort_order
       FROM custom_order_items coi
       JOIN custom_orders co ON co.id = coi.custom_order_id
       WHERE co.route_id = $1
       ORDER BY coi.sort_order ASC`,
      [routeId]
    )

    const itemsByOrder = new Map<number, CustomOrderItemRow[]>()
    for (const item of items.rows) {
      const list = itemsByOrder.get(item.custom_order_id) ?? []
      list.push(item)
      itemsByOrder.set(item.custom_order_id, list)
    }

    const result = orders.rows.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    }))

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch custom orders"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCustomOrderTables()

    const payload = await request.json()

    const routeId = typeof payload.route_id === "string" ? payload.route_id.trim() : ""
    const name = typeof payload.name === "string" ? payload.name.trim() : ""
    const items = Array.isArray(payload.items) ? payload.items : []

    if (!routeId || !name) {
      return NextResponse.json({ error: "route_id and name are required" }, { status: 400 })
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }

    const orderResult = await dbQuery<CustomOrderRow>(
      "INSERT INTO custom_orders (route_id, name) VALUES ($1, $2) RETURNING id, route_id, name, created_at",
      [routeId, name]
    )
    const order = orderResult.rows[0]

    const insertedItems: CustomOrderItemRow[] = []
    for (const item of items) {
      const locationCode = String(item.location_code ?? "").trim().toUpperCase()
      const sortOrder = Number(item.sort_order ?? 0)
      if (!locationCode) continue

      const itemResult = await dbQuery<CustomOrderItemRow>(
        `INSERT INTO custom_order_items (custom_order_id, location_code, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id, custom_order_id, location_code, sort_order`,
        [order.id, locationCode, sortOrder]
      )
      insertedItems.push(itemResult.rows[0])
    }

    return NextResponse.json({ ...order, items: insertedItems }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save custom order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureCustomOrderTables()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    await dbQuery("DELETE FROM custom_orders WHERE id = $1", [Number(id)])

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete custom order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

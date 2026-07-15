import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery } from "@/lib/db"

export const runtime = "nodejs"

interface DOItem {
  slot: string
  productCode: string
  productName: string
  qty: number
}

interface DeliveryOrder {
  id?: number
  code: string
  machine_id: string
  machine_label: string
  date: string
  status: "pending" | "completed"
  items?: DOItem[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (code) {
      // Get specific delivery order with items
      const doResult = await dbQuery<
        DeliveryOrder & { id: number }
      >(
        "SELECT id, code, machine_id, machine_label, date, status FROM delivery_orders WHERE code = $1",
        [code.toUpperCase()]
      )

      if (doResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Delivery order not found" },
          { status: 404 }
        )
      }

      const order = doResult.rows[0]

      const itemsResult = await dbQuery<DOItem>(
        "SELECT slot, product_code as productCode, product_name as productName, qty FROM delivery_order_items WHERE delivery_order_id = $1",
        [order.id]
      )

      return NextResponse.json({ ...order, items: itemsResult.rows })
    }

    // Get all delivery orders
    const result = await dbQuery<DeliveryOrder>(
      "SELECT code, machine_id, machine_label, date, status FROM delivery_orders ORDER BY created_at DESC"
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch delivery orders"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, machine_id, machine_label, date, items }: DeliveryOrder & { items: DOItem[] } = await request.json()

    if (!code || !machine_id || !machine_label || !date || !items) {
      return NextResponse.json(
        {
          error:
            "code, machine_id, machine_label, date, and items are required",
        },
        { status: 400 }
      )
    }

    // Start transaction
    const doResult = await dbQuery<DeliveryOrder & { id: number }>(
      "INSERT INTO delivery_orders (code, machine_id, machine_label, date, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id, code, machine_id, machine_label, date, status",
      [code, machine_id, machine_label, date]
    )

    const orderId = doResult.rows[0].id

    // Insert items
    for (const item of items) {
      await dbQuery(
        "INSERT INTO delivery_order_items (delivery_order_id, slot, product_code, product_name, qty) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.slot, item.productCode, item.productName, item.qty]
      )
    }

    const itemsResult = await dbQuery<DOItem>(
      "SELECT slot, product_code as productCode, product_name as productName, qty FROM delivery_order_items WHERE delivery_order_id = $1",
      [orderId]
    )

    return NextResponse.json(
      { ...doResult.rows[0], items: itemsResult.rows },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create delivery order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { code, status }: { code: string; status: "pending" | "completed" } = await request.json()

    if (!code || !status) {
      return NextResponse.json(
        { error: "code and status are required" },
        { status: 400 }
      )
    }

    const result = await dbQuery<DeliveryOrder>(
      "UPDATE delivery_orders SET status = $1, updated_at = NOW() WHERE code = $2 RETURNING code, machine_id, machine_label, date, status",
      [status, code.toUpperCase()]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Delivery order not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update delivery order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

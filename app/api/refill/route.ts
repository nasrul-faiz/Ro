import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery, getDbPool } from "@/lib/db"

export const runtime = "nodejs"

interface RefillItem {
  id?: number
  machine_id: string
  slot: string
  productCode: string
  productName: string
  image: string
  stockIn: number
  overflow: number
  stockOut: number
  currentInventory: number
  maxCapacity: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const machineId = searchParams.get("machine_id")

    let query = "SELECT * FROM refill_items"
    const params: (string | null)[] = []

    if (machineId) {
      query += " WHERE machine_id = $1"
      params.push(machineId)
    }

    query += " ORDER BY machine_id, slot ASC"

    const result = await dbQuery<any>(query, params)
    
    // Convert snake_case to camelCase
    const converted = result.rows.map((row: any) => ({
      machine_id: row.machine_id,
      slot: row.slot,
      productCode: row.product_code,
      productName: row.product_name,
      image: row.image,
      stockIn: row.stock_in,
      overflow: row.overflow,
      stockOut: row.stock_out,
      currentInventory: row.current_inventory,
      maxCapacity: row.max_capacity,
    }))
    
    return NextResponse.json(converted)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch refill items"
    console.error("[GET /api/refill] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const items: RefillItem[] = await request.json()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Array of items is required" },
        { status: 400 }
      )
    }

    const createdItems: RefillItem[] = []

    for (const item of items) {
      const result = await dbQuery<RefillItem>(
        `INSERT INTO refill_items 
         (machine_id, slot, product_code, product_name, image, stock_in, overflow, stock_out, current_inventory, max_capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (machine_id, slot) DO UPDATE SET
         product_code = $3,
         product_name = $4,
         image = $5,
         stock_in = $6,
         overflow = $7,
         stock_out = $8,
         current_inventory = $9,
         max_capacity = $10,
         updated_at = NOW()
         RETURNING *`,
        [
          item.machine_id,
          item.slot,
          item.productCode,
          item.productName,
          item.image,
          item.stockIn,
          item.overflow,
          item.stockOut,
          item.currentInventory,
          item.maxCapacity,
        ]
      )
      createdItems.push(result.rows[0])
    }

    return NextResponse.json(createdItems, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save refill items"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload: RefillItem | RefillItem[] = await request.json()

    if (Array.isArray(payload)) {
      const pool = getDbPool()
      const client = await pool.connect()

      try {
        await client.query("BEGIN")
        await client.query("DELETE FROM refill_items")

        for (const item of payload) {
          await client.query(
            `INSERT INTO refill_items
             (machine_id, slot, product_code, product_name, image, stock_in, overflow, stock_out, current_inventory, max_capacity)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              item.machine_id,
              item.slot,
              item.productCode,
              item.productName,
              item.image,
              item.stockIn,
              item.overflow,
              item.stockOut,
              item.currentInventory,
              item.maxCapacity,
            ]
          )
        }

        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      } finally {
        client.release()
      }

      return NextResponse.json({ success: true })
    }

    const item = payload

    if (!item.machine_id || !item.slot) {
      return NextResponse.json(
        { error: "machine_id and slot are required" },
        { status: 400 }
      )
    }

    const result = await dbQuery<RefillItem>(
      `UPDATE refill_items SET
       product_code = $1,
       product_name = $2,
       image = $3,
       stock_in = $4,
       overflow = $5,
       stock_out = $6,
       current_inventory = $7,
       max_capacity = $8,
       updated_at = NOW()
       WHERE machine_id = $9 AND slot = $10
       RETURNING *`,
      [
        item.productCode,
        item.productName,
        item.image,
        item.stockIn,
        item.overflow,
        item.stockOut,
        item.currentInventory,
        item.maxCapacity,
        item.machine_id,
        item.slot,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Refill item not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update refill item"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const machineId = searchParams.get("machine_id")
    const slot = searchParams.get("slot")
    const productCode = searchParams.get("product_code")

    if (machineId && slot) {
      await dbQuery(
        "DELETE FROM refill_items WHERE machine_id = $1 AND slot = $2",
        [machineId, slot]
      )
    } else if (productCode) {
      await dbQuery(
        "DELETE FROM refill_items WHERE product_code = $1",
        [productCode]
      )
    } else if (machineId) {
      await dbQuery(
        "DELETE FROM refill_items WHERE machine_id = $1",
        [machineId]
      )
    } else {
      return NextResponse.json(
        { error: "machine_id+slot, product_code, or machine_id is required" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete refill item"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

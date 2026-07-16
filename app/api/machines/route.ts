import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery } from "@/lib/db"

export const runtime = "nodejs"

interface Machine {
  id?: number
  value: string
  label: string
  shift?: string
  starting_point?: string
}

function normalizeShift(shift?: string): string {
  const normalized = (shift ?? "AM").toUpperCase()
  return normalized === "PM" ? "PM" : "AM"
}

async function ensureMachineColumns() {
  try {
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY,
        value VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(255) NOT NULL,
        shift VARCHAR(10) DEFAULT 'AM',
        starting_point VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await dbQuery("ALTER TABLE machines ADD COLUMN IF NOT EXISTS shift VARCHAR(10) DEFAULT 'AM'")
    await dbQuery("ALTER TABLE machines ADD COLUMN IF NOT EXISTS starting_point VARCHAR(255)")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ensure machine columns"
    console.error("[machines] Error ensuring columns:", message)
  }
}

export async function GET() {
  try {
    await ensureMachineColumns()
    const result = await dbQuery<Machine>(
      "SELECT id, value, label, shift, starting_point FROM machines ORDER BY created_at ASC"
    )
    return NextResponse.json(result.rows)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch machines"
    console.error("[GET /api/machines] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureMachineColumns()
    const { value, label, shift, starting_point }: Machine = await request.json()

    if (!value || !label) {
      return NextResponse.json(
        { error: "value and label are required" },
        { status: 400 }
      )
    }

    const result = await dbQuery<Machine>(
      "INSERT INTO machines (value, label, shift, starting_point) VALUES ($1, $2, $3, $4) RETURNING id, value, label, shift, starting_point",
      [value, label, normalizeShift(shift), starting_point ?? null]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create machine"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureMachineColumns()
    const { id, value, label, shift, starting_point }: Machine = await request.json()

    if (!id || !value || !label) {
      return NextResponse.json(
        { error: "id, value, and label are required" },
        { status: 400 }
      )
    }

    // Fetch old value to cascade machine_id in refill_items
    const existing = await dbQuery<Machine>(
      "SELECT value FROM machines WHERE id = $1",
      [id]
    )
    const oldValue = existing.rows[0]?.value

    const result = await dbQuery<Machine>(
      "UPDATE machines SET value = $1, label = $2, shift = $3, starting_point = $4, updated_at = NOW() WHERE id = $5 RETURNING id, value, label, shift, starting_point",
      [value, label, normalizeShift(shift), starting_point ?? null, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 })
    }

    // Cascade machine_id change to refill_items
    if (oldValue && oldValue !== value) {
      await dbQuery(
        "UPDATE refill_items SET machine_id = $1 WHERE machine_id = $2",
        [value, oldValue]
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update machine"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      )
    }

    await dbQuery("DELETE FROM machines WHERE id = $1", [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete machine"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

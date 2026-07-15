import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery } from "@/lib/db"

export const runtime = "nodejs"

interface Machine {
  id?: number
  value: string
  label: string
  shift?: string
}

function normalizeShift(shift?: string): string {
  const normalized = (shift ?? "AM").toUpperCase()
  return normalized === "PM" ? "PM" : "AM"
}

async function ensureMachineShiftColumn() {
  try {
    await dbQuery("ALTER TABLE machines ADD COLUMN IF NOT EXISTS shift VARCHAR(10) DEFAULT 'AM'")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ensure shift column"
    console.error("[machines] Error ensuring shift column:", message)
  }
}

export async function GET() {
  try {
    await ensureMachineShiftColumn()
    const result = await dbQuery<Machine>(
      "SELECT id, value, label, shift FROM machines ORDER BY created_at ASC"
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
    await ensureMachineShiftColumn()
    const { value, label, shift }: Machine = await request.json()

    if (!value || !label) {
      return NextResponse.json(
        { error: "value and label are required" },
        { status: 400 }
      )
    }

    const result = await dbQuery<Machine>(
      "INSERT INTO machines (value, label, shift) VALUES ($1, $2, $3) RETURNING id, value, label, shift",
      [value, label, normalizeShift(shift)]
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
    await ensureMachineShiftColumn()
    const { id, value, label, shift }: Machine = await request.json()

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
      "UPDATE machines SET value = $1, label = $2, shift = $3, updated_at = NOW() WHERE id = $4 RETURNING id, value, label, shift",
      [value, label, normalizeShift(shift), id]
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

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { dbQuery, getDbPool } from "@/lib/db"

export const runtime = "nodejs"

interface Product {
  id?: number
  product_code: string
  product_name: string
  image: string
  latitude?: number
  longitude?: number
  is_starting_point?: boolean
}

async function ensureProductsTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      product_code VARCHAR(100) NOT NULL UNIQUE,
      product_name VARCHAR(255) NOT NULL,
      image TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await dbQuery("ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude NUMERIC(11,7)")
  await dbQuery("ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,7)")
  await dbQuery("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_starting_point BOOLEAN DEFAULT FALSE")
}

export async function GET() {
  try {
    await ensureProductsTable()
    const result = await dbQuery<Product>(
      `SELECT id, product_code, product_name, COALESCE(image, '') AS image,
              latitude, longitude, is_starting_point
       FROM products ORDER BY is_starting_point DESC, product_code ASC`
    )
    return NextResponse.json(result.rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch products"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureProductsTable()
    const { product_code, product_name, image = "", latitude, longitude, is_starting_point = false }: Product =
      await request.json()

    if (!product_code || !product_name) {
      return NextResponse.json(
        { error: "product_code and product_name are required" },
        { status: 400 }
      )
    }

    const result = await dbQuery<Product>(
      `INSERT INTO products (product_code, product_name, image, latitude, longitude, is_starting_point)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, product_code, product_name, COALESCE(image, '') AS image, latitude, longitude, is_starting_point`,
      [product_code, product_name, image, latitude ?? null, longitude ?? null, is_starting_point]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create product"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureProductsTable()
    const payload = await request.json()

    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return NextResponse.json({ error: "At least one product is required" }, { status: 400 })
      }

      const pool = getDbPool()
      const client = await pool.connect()

      try {
        await client.query("BEGIN")
        await client.query("DELETE FROM products")

        for (const product of payload as Product[]) {
          await client.query(
            `INSERT INTO products (product_code, product_name, image, latitude, longitude, is_starting_point)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              product.product_code,
              product.product_name,
              product.image ?? "",
              product.latitude ?? null,
              product.longitude ?? null,
              product.is_starting_point ?? false,
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

    // Single product update
    const { id, product_code, product_name, image = "", latitude, longitude, previous_product_code }:
      Product & { previous_product_code?: string } = payload

    if (!id || !product_code || !product_name) {
      return NextResponse.json(
        { error: "id, product_code, and product_name are required" },
        { status: 400 }
      )
    }

    const result = await dbQuery<Product>(
      `UPDATE products
       SET product_code = $1, product_name = $2, image = $3,
           latitude = $4, longitude = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, product_code, product_name, COALESCE(image, '') AS image, latitude, longitude, is_starting_point`,
      [product_code, product_name, image, latitude ?? null, longitude ?? null, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Cascade rename to refill_items
    if (previous_product_code && previous_product_code !== product_code) {
      await dbQuery(
        `UPDATE refill_items
         SET product_code = $1, product_name = $2, image = $3, updated_at = NOW()
         WHERE product_code = $4`,
        [product_code, product_name, image, previous_product_code]
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update product"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureProductsTable()
    const { searchParams } = new URL(request.url)
    const productCode = searchParams.get("product_code")

    if (!productCode) {
      return NextResponse.json({ error: "product_code is required" }, { status: 400 })
    }

    await dbQuery("DELETE FROM products WHERE product_code = $1", [productCode])
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete product"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

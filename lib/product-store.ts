export const STARTING_POINT_CODE = "QLK"

export interface Product {
  productCode: string
  productName: string
  image: string
  latitude?: number
  longitude?: number
  isStartingPoint?: boolean
}

interface ApiProduct {
  id?: number
  product_code: string
  product_name: string
  image: string
  latitude?: number
  longitude?: number
  is_starting_point?: boolean
}

function fromApiProduct(item: ApiProduct): Product {
  return {
    productCode: item.product_code,
    productName: item.product_name,
    image: item.image ?? "",
    latitude: item.latitude != null ? Number(item.latitude) : undefined,
    longitude: item.longitude != null ? Number(item.longitude) : undefined,
    isStartingPoint: item.is_starting_point ?? false,
  }
}

function toApiProduct(item: Product): ApiProduct {
  return {
    product_code: item.productCode,
    product_name: item.productName,
    image: item.image,
    latitude: item.latitude,
    longitude: item.longitude,
    is_starting_point: item.isStartingPoint ?? false,
  }
}

function sortProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) =>
    a.productCode.localeCompare(b.productCode, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  )
}

export async function getProducts(): Promise<Product[]> {
  try {
    const response = await fetch("/api/products", { cache: "no-store" })
    if (!response.ok) throw new Error("Failed to fetch products")
    const data = await response.json()
    return sortProducts(data.map(fromApiProduct))
  } catch (error) {
    console.error("Error fetching products:", error)
    return []
  }
}

export async function replaceProducts(products: Product[]): Promise<boolean> {
  try {
    const response = await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(products.map(toApiProduct)),
    })
    if (!response.ok) throw new Error("Failed to replace products")
    return true
  } catch (error) {
    console.error("Error replacing products:", error)
    return false
  }
}

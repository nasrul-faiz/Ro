export interface CustomOrderItem {
  locationCode: string
  sortOrder: number
}

export interface CustomOrder {
  id: number
  routeId: string
  name: string
  createdAt?: string
  items: CustomOrderItem[]
}

interface ApiCustomOrderItem {
  location_code: string
  sort_order: number
}

interface ApiCustomOrder {
  id: number
  route_id: string
  name: string
  created_at?: string
  items?: ApiCustomOrderItem[]
}

function fromApi(order: ApiCustomOrder): CustomOrder {
  return {
    id: order.id,
    routeId: order.route_id,
    name: order.name,
    createdAt: order.created_at,
    items: (order.items ?? []).map((item) => ({
      locationCode: item.location_code,
      sortOrder: item.sort_order,
    })),
  }
}

export async function getCustomOrders(routeId: string): Promise<CustomOrder[]> {
  try {
    const response = await fetch(
      `/api/custom-orders?route_id=${encodeURIComponent(routeId)}`,
      { cache: "no-store" }
    )
    if (!response.ok) throw new Error("Failed to fetch custom orders")
    const data: ApiCustomOrder[] = await response.json()
    return data.map(fromApi)
  } catch (error) {
    console.error("Error fetching custom orders:", error)
    return []
  }
}

export async function saveCustomOrder(
  routeId: string,
  name: string,
  items: CustomOrderItem[]
): Promise<CustomOrder | null> {
  try {
    const response = await fetch("/api/custom-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_id: routeId,
        name,
        items: items.map((item) => ({
          location_code: item.locationCode,
          sort_order: item.sortOrder,
        })),
      }),
    })
    if (!response.ok) throw new Error("Failed to save custom order")
    const order: ApiCustomOrder = await response.json()
    return fromApi(order)
  } catch (error) {
    console.error("Error saving custom order:", error)
    return null
  }
}

export async function deleteCustomOrder(id: number): Promise<void> {
  try {
    const response = await fetch(`/api/custom-orders?id=${id}`, { method: "DELETE" })
    if (!response.ok) throw new Error("Failed to delete custom order")
  } catch (error) {
    console.error("Error deleting custom order:", error)
  }
}

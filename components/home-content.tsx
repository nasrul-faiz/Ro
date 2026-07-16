"use client"

import * as React from "react"
import { ChevronsUpDownIcon, ClipboardListIcon, MapPinIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { getMachines, type Machine } from "@/lib/machine-store"
import { getProducts, type Product } from "@/lib/product-store"
import { getRouteLocations, type RouteLocation } from "@/lib/route-location-store"
import { getAllDOs, DELIVERY_ORDERS_UPDATED_EVENT, type DeliveryOrder } from "@/lib/do-store"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSidebar } from "@/components/ui/sidebar"
import { LoadingText } from "@/components/ui/loading-text"
import { cn, compareCodes } from "@/lib/utils"

const ALL_ROUTES_VALUE = "__all_routes__"

interface HomeContentCache {
  machines: Machine[]
  products: Product[]
  assignments: RouteLocation[]
}

let homeContentCache: HomeContentCache | null = null

function findSelectedRoute(machines: Machine[], routeId?: string) {
  if (!routeId) return null
  return machines.find((item) => item.value === routeId) ?? null
}

interface HomeContentProps {
  initialRouteId?: string
}

export function HomeContent({ initialRouteId }: HomeContentProps) {
  const [machines, setMachines] = React.useState<Machine[]>(() => homeContentCache?.machines ?? [])
  const [products, setProducts] = React.useState<Product[]>(() => homeContentCache?.products ?? [])
  const [assignments, setAssignments] = React.useState<RouteLocation[]>(() => homeContentCache?.assignments ?? [])
  const [loading, setLoading] = React.useState(() => homeContentCache === null)
  const [selectedRoute, setSelectedRoute] = React.useState<Machine | null>(() =>
    findSelectedRoute(homeContentCache?.machines ?? [], initialRouteId)
  )
  const [routePickerOpen, setRoutePickerOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [allOrders, setAllOrders] = React.useState<DeliveryOrder[]>([])
  const [isViewDOOpen, setIsViewDOOpen] = React.useState(false)
  const router = useRouter()
  const { isMobile, setOpen, setOpenMobile } = useSidebar()

  React.useEffect(() => {
    let cancelled = false

    Promise.all([getMachines(), getProducts(), getRouteLocations()]).then(([machinesData, productsData, routeLocations]) => {
      if (cancelled) return

      homeContentCache = {
        machines: machinesData,
        products: productsData,
        assignments: routeLocations,
      }

      setMachines(machinesData)
      setProducts(productsData)
      setAssignments(routeLocations)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Load delivery orders and listen for updates
  React.useEffect(() => {
    async function reloadOrders() {
      const orders = await getAllDOs()
      setAllOrders(orders)
    }

    reloadOrders()

    window.addEventListener(DELIVERY_ORDERS_UPDATED_EVENT, reloadOrders)
    return () => {
      window.removeEventListener(DELIVERY_ORDERS_UPDATED_EVENT, reloadOrders)
    }
  }, [])

  React.useEffect(() => {
    if (loading) return

    if (!initialRouteId) {
      setSelectedRoute(null)
      return
    }

    const machine = machines.find((item) => item.value === initialRouteId) ?? null
    setSelectedRoute(machine)
  }, [initialRouteId, loading, machines])

  const productMap = React.useMemo(() => new Map(products.map((p) => [p.productCode, p])), [products])

  const visibleAssignments = React.useMemo(() => {
    if (!selectedRoute?.value) return []
    return assignments
      .filter((item) => item.routeId === selectedRoute.value)
      .sort((a, b) => compareCodes(a.locationCode, b.locationCode))
  }, [assignments, selectedRoute])

  const items = React.useMemo(
    () =>
      [...machines]
        .sort((a, b) => compareCodes(a.value, b.value))
        .map((machine) => ({
          label: `${machine.value} — ${machine.label}`,
          value: machine.value,
        })),
    [machines]
  )

  const filteredItems = React.useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return items

    return items.filter((item) => item.label.toLowerCase().includes(keyword))
  }, [items, searchQuery])

  // Today's delivery orders for the selected route
  const todayKey = new Date().toISOString().slice(0, 10)
  const todaysOrders = React.useMemo(
    () =>
      allOrders.filter(
        (order) =>
          order.machineId === selectedRoute?.value &&
          order.date.slice(0, 10) === todayKey
      ),
    [allOrders, selectedRoute, todayKey]
  )

  // Summarize DO items for the dialog
  const todaysItemSummary = React.useMemo(() => {
    const map = new Map<
      string,
      { slot: string; productCode: string; productName: string; qty: number }
    >()
    todaysOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${item.slot}-${item.productCode}`
        const existing = map.get(key)
        if (existing) {
          existing.qty += item.qty
        } else {
          map.set(key, { ...item })
        }
      })
    })
    return Array.from(map.values()).sort((a, b) =>
      a.slot.localeCompare(b.slot, undefined, { numeric: true, sensitivity: "base" })
    )
  }, [todaysOrders])

  const hasDeliveryToday = todaysOrders.length > 0

  function handleSelectRoute(value: string | null) {
    const nextValue = value === ALL_ROUTES_VALUE ? null : value
    const machine = machines.find((item) => item.value === nextValue) ?? null
    setSelectedRoute(machine)
    setRoutePickerOpen(false)
    setSearchQuery("")

    if (isMobile) {
      setOpenMobile(false)
    } else {
      setOpen(false)
    }

    if (!nextValue) {
      router.push("/home")
      return
    }

    router.push(`/home/${encodeURIComponent(nextValue)}`)
  }

  const hasInvalidRoute = Boolean(initialRouteId) && !loading && !selectedRoute

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Field className="w-full max-w-xl">
          <FieldLabel>Route</FieldLabel>
          <Popover open={routePickerOpen} onOpenChange={setRoutePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={routePickerOpen}
                className="h-9 w-full justify-between px-3 font-normal"
              >
                {selectedRoute ? `${selectedRoute.value} — ${selectedRoute.label}` : "All routes"}
                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-0"
            >
              <div className="border-b px-3 py-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Type route code or name..."
                  className="h-8 w-full border-0 bg-transparent px-0 text-sm outline-none"
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => handleSelectRoute(ALL_ROUTES_VALUE)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-muted",
                    !selectedRoute && "bg-muted"
                  )}
                >
                  All routes
                </button>
                {filteredItems.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No matching route.
                  </p>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelectRoute(item.value)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-muted",
                        selectedRoute?.value === item.value && "bg-muted"
                      )}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <FieldDescription>Each route now has its own URL, so you can open or share it directly.</FieldDescription>
        </Field>

      </div>

      {selectedRoute ? (
        <div className={cn(
          "rounded-xl border bg-card overflow-hidden text-xs",
          hasDeliveryToday && "ring-2 ring-emerald-400 ring-offset-1"
        )}>
          {/* Header bar with delivery indicator */}
          <div className={cn(
            "px-4 py-2 border-b flex items-center justify-between",
            hasDeliveryToday ? "bg-emerald-50/80 dark:bg-emerald-950/30" : "bg-muted/40"
          )}>
            <span className={cn(
              "text-[11px] font-semibold tracking-widest uppercase",
              hasDeliveryToday ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
            )}>
              {selectedRoute.value}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {visibleAssignments.length} location{visibleAssignments.length !== 1 && "s"}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={!hasDeliveryToday}
                onClick={() => setIsViewDOOpen(true)}
                className={`h-7 text-[11px] gap-1.5 px-2.5 ${hasDeliveryToday ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                variant={hasDeliveryToday ? "default" : "outline"}
              >
                <ClipboardListIcon className="size-3.5" />
                View DO
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs min-w-[600px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Code", "Name", "KM", "Delivery"].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[11px] font-semibold tracking-wide py-2 px-4 text-center"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No route locations assigned to this route yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleAssignments.map((assignment) => {
                    const product = productMap.get(assignment.locationCode)
                    return (
                      <TableRow
                        key={`${assignment.routeId}-${assignment.locationCode}`}
                        className={cn(
                          "h-10",
                          hasDeliveryToday && "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                        )}
                      >
                        <TableCell className="py-1.5 px-4 text-center font-medium">
                          {assignment.locationCode}
                        </TableCell>
                        <TableCell className="py-1.5 px-4 text-center font-medium">
                          {product?.productName ?? assignment.locationName ?? "Unknown"}
                        </TableCell>
                        <TableCell className="py-1.5 px-4 text-center font-medium tabular-nums">
                          {assignment.km != null ? (
                            <span>{assignment.km} km</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-4 text-center text-muted-foreground">
                          {product?.image || assignment.delivery || "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : hasInvalidRoute ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          <p>Route not found for this URL.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/home")}>
            Back to route list
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          {loading ? (
            <LoadingText text="Loading routes" className="py-0" />
          ) : (
            "Select a route from the dropdown to view its assigned locations."
          )}
        </div>
      )}

      {/* DO summary dialog */}
      <Dialog open={isViewDOOpen} onOpenChange={setIsViewDOOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>DO List Today — {selectedRoute?.value}</DialogTitle>
            <DialogDescription>
              {todaysOrders.length} generated DO(s) with {todaysItemSummary.length} item line(s).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table className="text-xs min-w-[480px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-center text-[11px] font-semibold tracking-wide py-2">Slot</TableHead>
                  <TableHead className="text-left text-[11px] font-semibold tracking-wide py-2">Product</TableHead>
                  <TableHead className="text-left text-[11px] font-semibold tracking-wide py-2">Code</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold tracking-wide py-2">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaysItemSummary.map((item) => (
                  <TableRow key={`${item.slot}-${item.productCode}`} className="h-9">
                    <TableCell className="text-center py-1.5">
                      <span className="font-mono font-bold tracking-wider">{item.slot}</span>
                    </TableCell>
                    <TableCell className="py-1.5 font-medium">{item.productName}</TableCell>
                    <TableCell className="py-1.5 text-muted-foreground">{item.productCode}</TableCell>
                    <TableCell className="py-1.5 text-right font-semibold tabular-nums">{item.qty}</TableCell>
                  </TableRow>
                ))}
                {todaysItemSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      No orders for this route today.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { getMachines, type Machine } from "@/lib/machine-store"
import { getProducts, type Product } from "@/lib/product-store"
import { getRouteLocations, type RouteLocation } from "@/lib/route-location-store"
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
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

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
      .sort((a, b) => a.locationCode.localeCompare(b.locationCode))
  }, [assignments, selectedRoute])

  const items = React.useMemo(
    () =>
      machines.map((machine) => ({
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
        <div className="rounded-xl border bg-card overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <Table className="text-xs min-w-[600px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Code', 'Name', 'Delivery'].map((h) => (
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
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      No route locations assigned to this route yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleAssignments.map((assignment) => {
                    const product = productMap.get(assignment.locationCode)
                    return (
                      <TableRow key={`${assignment.routeId}-${assignment.locationCode}`} className="h-10">
                        <TableCell className="py-1.5 px-4 text-center font-mono font-bold tracking-wider">
                          {assignment.locationCode}
                        </TableCell>
                        <TableCell className="py-1.5 px-4 text-center text-muted-foreground">
                          {product?.productName ?? assignment.locationName ?? "Unknown"}
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
          {loading ? "Loading routes..." : "Select a route from the dropdown to view its assigned locations."}
        </div>
      )}
    </div>
  )
}

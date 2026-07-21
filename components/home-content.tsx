"use client"

import * as React from "react"
import {
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FilterIcon,
  ArrowUpDownIcon,
  SettingsIcon,
  LocateIcon,
  Columns3Icon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { getMachines, type Machine } from "@/lib/machine-store"
import { getProducts, type Product } from "@/lib/product-store"
import { getRouteLocations, type RouteLocation } from "@/lib/route-location-store"
import { getAllDOs, DELIVERY_ORDERS_UPDATED_EVENT, type DeliveryOrder } from "@/lib/do-store"
import { getDrivingDistanceKm } from "@/lib/geo"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import { cn, compareCodes, isDeliveryActive, getDeliveryDescription } from "@/lib/utils"

const ALL_ROUTES_VALUE = "__all_routes__"

const COLUMN_OPTIONS = [
  { id: "no", label: "No" },
  { id: "route", label: "Route" },
  { id: "code", label: "Code" },
  { id: "name", label: "Name" },
  { id: "delivery", label: "Delivery" },
  { id: "km", label: "KM" },
] as const

type ColumnId = (typeof COLUMN_OPTIONS)[number]["id"]

function formatRouteCode(code: string) {
  const match = code.match(/^([A-Za-z]+)\s*(\d+)$/)
  if (!match) return code
  return `${match[1]} ${match[2]}`
}

function formatKm(value: number) {
  return `${value.toFixed(1)} Km`
}

const DEFAULT_COLUMN_VISIBILITY: Record<ColumnId, boolean> = {
  no: true,
  route: false,
  code: true,
  name: true,
  delivery: true,
  km: false,
}

const SORTABLE_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "name", label: "Name" },
  { id: "delivery", label: "Delivery" },
  { id: "km", label: "KM" },
]

type SortConfig = { key: ColumnId; dir: "asc" | "desc" }

type DeliveryFilter = "all" | "active" | "inactive"

type SettingsTab = "filter" | "sorting" | "columns"

function getSortValue(assignment: RouteLocation, key: ColumnId, productMap: Map<string, Product>) {
  switch (key) {
    case "name":
      return productMap.get(assignment.locationCode)?.productName ?? assignment.locationName ?? ""
    case "delivery":
      return productMap.get(assignment.locationCode)?.image || assignment.delivery || ""
    default:
      return ""
  }
}

function compareBySort(a: RouteLocation, b: RouteLocation, sort: SortConfig, productMap: Map<string, Product>) {
  let result = 0
  if (sort.key === "code") {
    result = compareCodes(a.locationCode, b.locationCode)
  } else if (sort.key === "km") {
    const av = a.km ?? Number.POSITIVE_INFINITY
    const bv = b.km ?? Number.POSITIVE_INFINITY
    result = av - bv
  } else {
    const av = String(getSortValue(a, sort.key, productMap))
    const bv = String(getSortValue(b, sort.key, productMap))
    result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
  }
  return sort.dir === "desc" ? -result : result
}

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
  const [customStart, setCustomStart] = React.useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = React.useState(false)
  const [geoError, setGeoError] = React.useState("")
  const [liveKmCache, setLiveKmCache] = React.useState<Record<string, number | null>>({})
  const liveKmFetchingRef = React.useRef<Set<string>>(new Set())
  const [columnVisibility, setColumnVisibility] = React.useState<Record<ColumnId, boolean>>(DEFAULT_COLUMN_VISIBILITY)
  const [deliveryFilter, setDeliveryFilter] = React.useState<DeliveryFilter>("all")
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [settingsTab, setSettingsTab] = React.useState<SettingsTab>("filter")
  const router = useRouter()
  const { isMobile, setOpen, setOpenMobile } = useSidebar()

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported.")
      return
    }
    setGeoLoading(true)
    setGeoError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomStart({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLiveKmCache({})
        setGeoLoading(false)
      },
      () => {
        setGeoError("Could not get location.")
        setGeoLoading(false)
      }
    )
  }

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

  const visibleColumns = React.useMemo(
    () => COLUMN_OPTIONS.filter((column) => columnVisibility[column.id]),
    [columnVisibility]
  )

  function toggleColumn(id: ColumnId, checked: boolean) {
    setColumnVisibility((prev) => ({ ...prev, [id]: checked }))
  }

  const productMap = React.useMemo(() => new Map(products.map((p) => [p.productCode, p])), [products])

  const visibleAssignments = React.useMemo(() => {
    if (!selectedRoute?.value) return []
    let filtered = assignments.filter((item) => item.routeId === selectedRoute.value)

    if (deliveryFilter !== "all") {
      filtered = filtered.filter((item) => {
        const deliveryValue = productMap.get(item.locationCode)?.image || item.delivery
        const active = isDeliveryActive(deliveryValue)
        return deliveryFilter === "active" ? active : !active
      })
    }

    if (sortConfig) {
      return [...filtered].sort((a, b) => compareBySort(a, b, sortConfig, productMap))
    }

    const sorted = [...filtered].sort((a, b) => compareCodes(a.locationCode, b.locationCode))

    // Active-today locations first, locations with no delivery today pushed to the bottom.
    const active: RouteLocation[] = []
    const inactive: RouteLocation[] = []
    sorted.forEach((item) => {
      const deliveryValue = productMap.get(item.locationCode)?.image || item.delivery
      if (isDeliveryActive(deliveryValue)) {
        active.push(item)
      } else {
        inactive.push(item)
      }
    })
    return [...active, ...inactive]
  }, [assignments, selectedRoute, productMap, deliveryFilter, sortConfig])

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

  const hasDeliveryToday = todaysOrders.length > 0

  // Live driving distance from the user's current location (once captured)
  // to each visible location, used to override the stored KM figures.
  React.useEffect(() => {
    if (!customStart) return

    visibleAssignments.forEach((assignment) => {
      const code = assignment.locationCode
      if (code in liveKmCache) return
      if (liveKmFetchingRef.current.has(code)) return
      const loc = productMap.get(code)
      if (!loc?.latitude || !loc?.longitude) return

      liveKmFetchingRef.current.add(code)
      getDrivingDistanceKm(customStart.lat, customStart.lng, loc.latitude, loc.longitude).then((km) => {
        liveKmFetchingRef.current.delete(code)
        setLiveKmCache((prev) => ({ ...prev, [code]: km }))
      })
    })
  }, [customStart, visibleAssignments, productMap, liveKmCache])

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Field className="w-full max-w-sm">
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
          "glass-card overflow-hidden rounded-2xl text-xs",
          hasDeliveryToday && "ring-2 ring-emerald-400 ring-offset-1"
        )}>
          {/* Header bar with delivery indicator */}
          <div className={cn(
            "px-5 py-3 border-b flex items-center justify-end gap-4",
            hasDeliveryToday ? "bg-emerald-50/80 dark:bg-emerald-950/30" : "bg-muted/40"
          )}>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={geoLoading}
              title={geoError || "Use your current location as the starting point for distance calculations"}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
            >
              <LocateIcon className="size-3.5" />
              {geoLoading
                ? "Getting location…"
                : customStart
                  ? `${customStart.lat.toFixed(5)}, ${customStart.lng.toFixed(5)}`
                  : "Default Starting Point"}
            </button>
            <Button
              type="button"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-7 text-[11px] gap-1.5 px-2.5 border-slate-400 bg-slate-300 text-slate-800 hover:bg-slate-400 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
              variant="outline"
            >
              <SettingsIcon className="size-3.5" />
              Settings
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs min-w-[600px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className="text-[11px] font-semibold tracking-wide py-3 px-5 text-center"
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length} className="py-10 text-center text-muted-foreground">
                      No route locations assigned to this route yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleAssignments.map((assignment, index) => {
                    const product = productMap.get(assignment.locationCode)
                    const deliveryValue = product?.image || assignment.delivery
                    const isActiveToday = isDeliveryActive(deliveryValue)
                    return (
                      <TableRow
                        key={`${assignment.routeId}-${assignment.locationCode}`}
                        className={cn(
                          "h-12",
                          isActiveToday
                            ? hasDeliveryToday && "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                            : "text-muted-foreground/60 hover:bg-muted/30"
                        )}
                      >
                        {columnVisibility.no && (
                          <TableCell className="py-2.5 px-5 text-center font-medium tabular-nums">
                            {index + 1}
                          </TableCell>
                        )}
                        {columnVisibility.route && (
                          <TableCell className="py-2.5 px-5 text-center font-medium">
                            {formatRouteCode(assignment.routeId)}
                          </TableCell>
                        )}
                        {columnVisibility.code && (
                          <TableCell className="py-2.5 px-5 text-center font-medium">
                            {assignment.locationCode}
                          </TableCell>
                        )}
                        {columnVisibility.name && (
                          <TableCell className="py-2.5 px-5 text-center font-medium">
                            {product?.productName ?? assignment.locationName ?? "Unknown"}
                          </TableCell>
                        )}
                        {columnVisibility.delivery && (
                          <TableCell className="py-2.5 px-5 text-center text-muted-foreground">
                            {deliveryValue ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="rounded px-1.5 py-0.5 hover:bg-muted/60 hover:text-foreground"
                                  >
                                    {deliveryValue}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto px-3 py-2 text-xs">
                                  {getDeliveryDescription(deliveryValue)}
                                </PopoverContent>
                              </Popover>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.km && (
                        <TableCell className="py-2.5 px-5 text-center font-medium tabular-nums">
                          {customStart ? (
                            assignment.locationCode in liveKmCache ? (
                              liveKmCache[assignment.locationCode] != null ? (
                                <span>{formatKm(liveKmCache[assignment.locationCode]!)}</span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )
                            ) : (
                              <span className="text-muted-foreground/40 text-[10px]">…</span>
                            )
                          ) : assignment.km != null ? (
                            <span>{formatKm(assignment.km)}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumns.length} className="py-3 px-5">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[11px] font-semibold tracking-widest uppercase",
                        hasDeliveryToday ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                      )}>
                        {selectedRoute.value}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {visibleAssignments.length} location{visibleAssignments.length !== 1 && "s"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4">
            <DialogTitle>Table Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Filter, sort and customize the visible columns of the route list table.
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 px-4 pt-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  { id: "filter", label: "Filter", icon: <FilterIcon className="size-3.5" /> },
                  { id: "sorting", label: "Sorting", icon: <ArrowUpDownIcon className="size-3.5" /> },
                  { id: "columns", label: "Columns", icon: <Columns3Icon className="size-3.5" /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSettingsTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors",
                    settingsTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {settingsTab === "filter" && (
              <FieldSet>
                <FieldLegend variant="label">Delivery status</FieldLegend>
                <FieldDescription>
                  Show all locations, or only those that are active or inactive for delivery today.
                </FieldDescription>
                <FieldGroup className="gap-1.5">
                  {(
                    [
                      { id: "all", label: "All locations" },
                      { id: "active", label: "Active today only" },
                      { id: "inactive", label: "Inactive today only" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDeliveryFilter(option.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                        deliveryFilter === option.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </FieldGroup>
              </FieldSet>
            )}

            {settingsTab === "sorting" && (
              <div className="flex flex-col gap-4">
                <FieldSet>
                  <FieldLegend variant="label">Quick sort</FieldLegend>
                  <FieldDescription>
                    Pick a column to sort by. Click it again to switch between ascending and descending.
                  </FieldDescription>
                  <FieldGroup className="gap-1.5">
                    {SORTABLE_COLUMNS.map((column) => {
                      const isActive = sortConfig?.key === column.id
                      const dir = isActive ? sortConfig.dir : "asc"
                      return (
                        <button
                          key={column.id}
                          type="button"
                          onClick={() =>
                            setSortConfig(
                              isActive ? { key: column.id, dir: dir === "asc" ? "desc" : "asc" } : { key: column.id, dir: "asc" }
                            )
                          }
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span>{column.label}</span>
                          {isActive ? (
                            dir === "asc" ? (
                              <ChevronUpIcon className="size-4" />
                            ) : (
                              <ChevronDownIcon className="size-4" />
                            )
                          ) : (
                            <ChevronsUpDownIcon className="size-4 opacity-40" />
                          )}
                        </button>
                      )
                    })}
                  </FieldGroup>
                </FieldSet>
                {sortConfig && (
                  <button
                    type="button"
                    onClick={() => setSortConfig(null)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-4" />
                    Clear sorting
                  </button>
                )}
              </div>
            )}

            {settingsTab === "columns" && (
              <FieldSet>
                <FieldLegend variant="label">Visible columns</FieldLegend>
                <FieldDescription>
                  Select the columns you want to show in the table.
                </FieldDescription>
                <FieldGroup className="gap-3">
                  {COLUMN_OPTIONS.map((column) => (
                    <Field key={column.id} orientation="horizontal">
                      <Checkbox
                        id={`route-list-column-${column.id}`}
                        name={`route-list-column-${column.id}`}
                        checked={columnVisibility[column.id]}
                        onCheckedChange={(checked) => toggleColumn(column.id, checked === true)}
                        disabled={columnVisibility[column.id] && visibleColumns.length === 1}
                      />
                      <FieldLabel
                        htmlFor={`route-list-column-${column.id}`}
                        className="font-normal"
                      >
                        {column.label}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

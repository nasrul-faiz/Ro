"use client"

import * as React from "react"
import { PlusIcon, CheckIcon, XIcon } from "lucide-react"
import { getMachines, type Machine } from "@/lib/machine-store"
import { getProducts, type Product, STARTING_POINT_CODE } from "@/lib/product-store"
import { getDrivingDistanceKm } from "@/lib/geo"
import { LoadingText } from "@/components/ui/loading-text"
import {
  getRouteLocations,
  upsertRouteLocations,
  deleteRouteLocation,
  type RouteLocation,
} from "@/lib/route-location-store"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { compareCodes } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────
interface AssignmentDraft {
  routeId: string
  locationCode: string
  originalLocationCode?: string
}

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"

// ─── Edit row ───────────────────────────────────────────────────────────────
interface AssignmentEditRowProps {
  availableProducts: Product[]
  draft: AssignmentDraft
  onDraftChange: (draft: AssignmentDraft) => void
  onConfirm: () => void
  onCancel: () => void
}

function AssignmentEditRow({ availableProducts, draft, onDraftChange, onConfirm, onCancel }: AssignmentEditRowProps) {
  return (
    <TableRow className="bg-accent/20">
      <TableCell className="py-1.5 text-center font-mono text-muted-foreground">
        {draft.locationCode || "-"}
      </TableCell>
      <TableCell className="py-1.5">
        <select className={inputCls} value={draft.locationCode}
          onChange={(e) => onDraftChange({ ...draft, locationCode: e.target.value })}>
          <option value="">Select location</option>
          {availableProducts.map((p) => (
            <option key={p.productCode} value={p.productCode}>
              {p.productCode} — {p.productName}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="py-1.5 text-center text-muted-foreground">-</TableCell>
      <TableCell className="py-1.5 text-center text-muted-foreground/40">—</TableCell>
      <TableCell className="py-1.5">
        <div className="flex justify-center gap-1">
          <button onClick={onConfirm}
            className="rounded p-1 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20">
            <CheckIcon className="size-3.5" />
          </button>
          <button onClick={onCancel}
            className="rounded p-1 bg-red-600/10 text-red-600 hover:bg-red-600/20">
            <XIcon className="size-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
interface EditMachineProductsContentProps {
  onSaveRef?: React.MutableRefObject<(() => Promise<void>) | null>
  onDirtyChange?: (dirty: boolean) => void
}

export function EditMachineProductsContent({ onSaveRef, onDirtyChange }: EditMachineProductsContentProps) {
  const [routes, setRoutes] = React.useState<Machine[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [assignments, setAssignments] = React.useState<RouteLocation[]>([])
  const [drafts, setDrafts] = React.useState<Record<string, AssignmentDraft>>({})
  const [loading, setLoading] = React.useState(true)
  const [selectedRouteId, setSelectedRouteId] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [activeAddDraftKey, setActiveAddDraftKey] = React.useState<string | null>(null)
  const [pendingDraftKeys, setPendingDraftKeys] = React.useState<string[]>([])
  const [newAssignment, setNewAssignment] = React.useState<AssignmentDraft>({
    routeId: "",
    locationCode: "",
  })

  React.useEffect(() => {
    Promise.all([getMachines(), getProducts(), getRouteLocations()]).then(([ms, ps, rs]) => {
      setRoutes(ms)
      setProducts(ps)
      setAssignments(rs)
      const first = ms[0]?.value ?? ""
      setSelectedRouteId(first)
      setNewAssignment((prev) => ({ ...prev, routeId: first }))
      setLoading(false)
    })
  }, [])

  const assignmentKey = (item: Pick<RouteLocation, "routeId" | "locationCode">) =>
    `${item.routeId}::${item.locationCode}`

  const sortedRoutes = React.useMemo(
    () => [...routes].sort((a, b) => compareCodes(a.value, b.value)),
    [routes]
  )

  // Exclude the starting point product from the selector
  const selectableProducts = React.useMemo(
    () => products.filter((p) => !p.isStartingPoint && p.productCode !== STARTING_POINT_CODE),
    [products]
  )

  // Starting point product (for KM calculation)
  const startingPointProduct = React.useMemo(
    () => products.find((p) => p.isStartingPoint || p.productCode === STARTING_POINT_CODE) ?? null,
    [products]
  )

  const productMap = React.useMemo(() => new Map(products.map((p) => [p.productCode, p])), [products])

  const visibleAssignments = assignments
    .filter((item) => item.routeId === selectedRouteId)
    .sort((a, b) => compareCodes(a.locationCode, b.locationCode))

  // Road-distance (driving) cache, keyed by location code. `undefined` means
  // not yet fetched, `null` means computed but no route/coords available.
  const [kmCache, setKmCache] = React.useState<Record<string, number | null>>({})
  const kmFetchingRef = React.useRef<Set<string>>(new Set())

  const assignedLocationCodes = React.useMemo(() => {
    const codes = new Set<string>()
    assignments.forEach((a) => { if (a.locationCode) codes.add(a.locationCode) })
    pendingDraftKeys.forEach((key) => {
      const lc = drafts[key]?.locationCode?.trim().toUpperCase()
      if (lc) codes.add(lc)
    })
    return codes
  }, [assignments, drafts, pendingDraftKeys])

  function getAvailableProducts(draft: AssignmentDraft) {
    const cur = draft.locationCode?.trim().toUpperCase()
    const orig = draft.originalLocationCode?.trim().toUpperCase()
    return selectableProducts.filter((p) => {
      if (p.productCode === cur) return true
      if (p.productCode === orig) return true
      return !assignedLocationCodes.has(p.productCode)
    })
  }

  // Real driving (road) distance from starting point to a location, in km.
  // Returns undefined while the distance is still being calculated.
  function getKm(locationCode: string): number | null | undefined {
    return kmCache[locationCode]
  }

  // Fetch road-distance (car/lorry) for every location currently shown, and
  // backfill it into the database for saved assignments that don't have one.
  React.useEffect(() => {
    if (!startingPointProduct?.latitude || !startingPointProduct?.longitude) return
    const spLat = startingPointProduct.latitude
    const spLng = startingPointProduct.longitude

    const codesNeeded = new Set<string>()
    visibleAssignments.forEach((a) => codesNeeded.add(a.locationCode))
    pendingDraftKeys.forEach((key) => {
      const lc = drafts[key]?.locationCode
      if (lc) codesNeeded.add(lc)
    })

    codesNeeded.forEach((code) => {
      if (code in kmCache) return
      if (kmFetchingRef.current.has(code)) return
      const loc = productMap.get(code)
      if (!loc?.latitude || !loc?.longitude) return

      kmFetchingRef.current.add(code)
      getDrivingDistanceKm(spLat, spLng, loc.latitude, loc.longitude).then((km) => {
        kmFetchingRef.current.delete(code)
        setKmCache((prev) => ({ ...prev, [code]: km }))

        if (km == null) return

        const existing = assignments.find(
          (a) => a.routeId === selectedRouteId && a.locationCode === code
        )
        if (existing && existing.km == null) {
          upsertRouteLocations([{ routeId: existing.routeId, locationCode: existing.locationCode, km }]).then(
            (ok) => {
              if (!ok) return
              setAssignments((prev) =>
                prev.map((a) =>
                  a.routeId === existing.routeId && a.locationCode === existing.locationCode
                    ? { ...a, km }
                    : a
                )
              )
            }
          )
        }
      })
    })
  }, [visibleAssignments, pendingDraftKeys, drafts, productMap, startingPointProduct, kmCache, assignments, selectedRouteId])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSaveAll = React.useCallback(async () => {
    if (pendingDraftKeys.length === 0) return

    const upsertPayload: RouteLocation[] = []
    const seenKeys = new Set<string>()

    for (const key of pendingDraftKeys) {
      const draft = drafts[key]
      if (!draft) continue

      const routeId = draft.routeId.trim()
      const locationCode = draft.locationCode.trim().toUpperCase()
      if (!routeId || !locationCode) continue

      if (draft.originalLocationCode && draft.originalLocationCode !== locationCode) {
        await deleteRouteLocation(routeId, draft.originalLocationCode)
      }

      const compositeKey = `${routeId}::${locationCode}`
      if (seenKeys.has(compositeKey)) continue
      seenKeys.add(compositeKey)

      const km = kmCache[locationCode] ?? undefined
      upsertPayload.push({ routeId, locationCode, km })
    }

    if (upsertPayload.length > 0) {
      await upsertRouteLocations(upsertPayload)
    }

    const refreshed = await getRouteLocations()
    setAssignments(refreshed)
    setDrafts({})
    setAdding(false)
    setActiveAddDraftKey(null)
    setPendingDraftKeys([])
  }, [drafts, pendingDraftKeys, kmCache])

  React.useEffect(() => {
    if (onSaveRef) onSaveRef.current = handleSaveAll
  }, [handleSaveAll, onSaveRef])

  React.useEffect(() => {
    onDirtyChange?.(pendingDraftKeys.length > 0)
  }, [pendingDraftKeys, onDirtyChange])

  async function handleDelete(assignment: RouteLocation) {
    const ok = await deleteRouteLocation(assignment.routeId, assignment.locationCode)
    if (!ok) return
    setAssignments((prev) => prev.filter((item) => assignmentKey(item) !== assignmentKey(assignment)))
  }

  function startAdd() {
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setAdding(true)
    setActiveAddDraftKey(key)
    setDrafts((prev) => ({ ...prev, [key]: { ...newAssignment, routeId: selectedRouteId } }))
  }

  function confirmDraft() {
    if (adding && activeAddDraftKey && drafts[activeAddDraftKey]) {
      const key = activeAddDraftKey
      setPendingDraftKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
      setAdding(false)
      setActiveAddDraftKey(null)
    }
  }

  function removeDraft(key: string) {
    setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n })
    setPendingDraftKeys((prev) => prev.filter((k) => k !== key))
    if (activeAddDraftKey === key) setActiveAddDraftKey(null)
  }

  if (loading) return <LoadingText />

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card overflow-hidden text-xs">
        <div className="px-4 py-3 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              Route
            </span>
            <select
              value={selectedRouteId}
              onChange={(e) => {
                setSelectedRouteId(e.target.value)
                setAdding(false)
                setNewAssignment((prev) => ({ ...prev, routeId: e.target.value }))
              }}
              className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
            >
              {sortedRoutes.map((route) => (
                <option key={route.value} value={route.value}>
                  {route.value} — {route.label}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!selectedRouteId || selectableProducts.length === 0 || adding}
            onClick={startAdd}>
            <PlusIcon className="size-3.5" />
            Add Route Location
          </Button>
        </div>

        {startingPointProduct?.latitude != null && (
          <div className="px-4 py-2 border-b bg-sky-50/50 dark:bg-sky-950/20 text-[11px] text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
            <span className="font-semibold">QL Kitchen:</span>
            <span className="font-mono">
              {startingPointProduct.latitude.toFixed(5)}, {startingPointProduct.longitude!.toFixed(5)}
            </span>
            {!startingPointProduct.latitude && (
              <span className="italic text-muted-foreground">Not set — add in Location Master</span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table className="text-xs min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Code", "Name", "Delivery", "KM", "Actions"].map((h) => (
                  <TableHead key={h}
                    className="text-center text-[11px] font-semibold tracking-wide py-2">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add row */}
              {adding && activeAddDraftKey && drafts[activeAddDraftKey] && (
                <AssignmentEditRow
                  availableProducts={getAvailableProducts(drafts[activeAddDraftKey])}
                  draft={drafts[activeAddDraftKey]}
                  onDraftChange={(d) => setDrafts((prev) => ({ ...prev, [activeAddDraftKey]: d }))}
                  onConfirm={confirmDraft}
                  onCancel={() => { removeDraft(activeAddDraftKey); setAdding(false) }}
                />
              )}

              {/* Pending new drafts */}
              {pendingDraftKeys
                .filter((key) => !visibleAssignments.some((a) => assignmentKey(a) === key) && drafts[key])
                .map((key) => {
                  const draft = drafts[key]
                  const product = productMap.get(draft.locationCode ?? "")
                  const km = getKm(draft.locationCode ?? "")
                  return (
                    <TableRow key={key} className="h-10 bg-emerald-50/60 dark:bg-emerald-950/20">
                      <TableCell className="text-center py-1.5 font-medium">
                        {draft.locationCode}
                      </TableCell>
                      <TableCell className="py-1.5 text-center font-medium">
                        {product?.productName ?? "Unknown"}
                        <span className="ml-2 text-[10px] text-emerald-600 font-medium uppercase">Pending</span>
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-muted-foreground">
                        {product?.image || "-"}
                      </TableCell>
                      <TableCell className="text-center py-1.5 font-medium tabular-nums">
                        {km === undefined ? "Calculating…" : km != null ? `${km} km` : "—"}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex justify-center">
                          <ConfirmDeleteDialog
                            trigger={<Button variant="destructive" size="sm">Remove</Button>}
                            title="Remove pending location?"
                            description="This pending draft will be discarded."
                            onConfirm={() => removeDraft(key)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}

              {/* Saved assignments */}
              {visibleAssignments.map((assignment) => {
                const key = assignmentKey(assignment)
                const product = productMap.get(assignment.locationCode)
                const km = getKm(assignment.locationCode)

                return (
                  <TableRow key={key} className="h-10">
                    <TableCell className="text-center py-1.5 font-medium">
                      {assignment.locationCode}
                    </TableCell>
                    <TableCell className="py-1.5 text-center font-medium">
                      {product?.productName ?? assignment.locationName ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground">
                      {product?.image || assignment.delivery || "-"}
                    </TableCell>
                    <TableCell className="text-center py-1.5 font-medium tabular-nums">
                      {km === undefined ? (
                        <span className="text-muted-foreground/40 text-[11px] italic">Calculating…</span>
                      ) : km != null ? (
                        <span className="font-medium text-foreground">{km} km</span>
                      ) : (
                        <span className="text-muted-foreground/40 text-[11px] italic">Set coords in Location Master</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex justify-center">
                        <ConfirmDeleteDialog
                          trigger={<Button variant="destructive" size="sm">Remove</Button>}
                          title="Delete route location?"
                          description="This will remove the location from this route."
                          onConfirm={() => handleDelete(assignment)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {selectedRouteId && visibleAssignments.length === 0 && !adding && pendingDraftKeys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No route locations assigned yet. Click{" "}
                    <span className="font-medium text-foreground">Add Route Location</span> to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import {
  PlusIcon,
  CheckIcon,
  XIcon,
} from "lucide-react"
import { getMachines, type Machine } from "@/lib/machine-store"
import { getProducts, type Product } from "@/lib/product-store"
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

interface AssignmentDraft {
  routeId: string
  locationCode: string
  originalLocationCode?: string
}

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"

interface AssignmentEditRowProps {
  availableProducts: Product[]
  draft: AssignmentDraft
  onDraftChange: (draft: AssignmentDraft) => void
  onConfirm: () => void
  onCancel: () => void
}

function AssignmentEditRow({
  availableProducts,
  draft,
  onDraftChange,
  onConfirm,
  onCancel,
}: AssignmentEditRowProps) {
  return (
    <TableRow className="bg-accent/20">
      <TableCell className="py-1.5 text-center font-mono text-muted-foreground">
        {draft.locationCode || "-"}
      </TableCell>
      <TableCell className="py-1.5">
        <select
          className={inputCls}
          value={draft.locationCode}
          onChange={(e) => onDraftChange({ ...draft, locationCode: e.target.value })}
        >
          <option value="">Select location</option>
          {availableProducts.map((p) => (
            <option key={p.productCode} value={p.productCode}>
              {p.productCode} — {p.productName}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="py-1.5 text-center text-muted-foreground">-</TableCell>
      <TableCell className="py-1.5">
        <div className="flex justify-center gap-1">
          <button
            onClick={onConfirm}
            className="rounded p-1 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20"
          >
            <CheckIcon className="size-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="rounded p-1 bg-red-600/10 text-red-600 hover:bg-red-600/20"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

interface EditMachineProductsContentProps {
  onSaveRef?: React.MutableRefObject<(() => Promise<void>) | null>
}

export function EditMachineProductsContent({ onSaveRef }: EditMachineProductsContentProps) {
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
    Promise.all([getMachines(), getProducts(), getRouteLocations()]).then(
      ([ms, ps, rs]) => {
        setRoutes(ms)
        setProducts(ps)
        setAssignments(rs)

        const first = ms[0]?.value ?? ""
        setSelectedRouteId(first)
        setNewAssignment((prev) => ({ ...prev, routeId: first }))
        setLoading(false)
      }
    )
  }, [])

  const assignmentKey = (item: Pick<RouteLocation, "routeId" | "locationCode">) =>
    `${item.routeId}::${item.locationCode}`

  const visibleAssignments = assignments
    .filter((item) => item.routeId === selectedRouteId)
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode))

  const productMap = React.useMemo(
    () => new Map(products.map((p) => [p.productCode, p])),
    [products]
  )

  const assignedLocationCodes = React.useMemo(() => {
    const codes = new Set<string>()

    assignments.forEach((assignment) => {
      if (assignment.locationCode) {
        codes.add(assignment.locationCode)
      }
    })

    pendingDraftKeys.forEach((key) => {
      const locationCode = drafts[key]?.locationCode?.trim().toUpperCase()
      if (locationCode) {
        codes.add(locationCode)
      }
    })

    return codes
  }, [assignments, drafts, pendingDraftKeys])

  function getAvailableProducts(draft: AssignmentDraft) {
    const currentLocationCode = draft.locationCode?.trim().toUpperCase()
    const originalLocationCode = draft.originalLocationCode?.trim().toUpperCase()

    return products.filter((product) => {
      if (product.productCode === currentLocationCode) return true
      if (product.productCode === originalLocationCode) return true
      return !assignedLocationCodes.has(product.productCode)
    })
  }

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

      upsertPayload.push({
        routeId,
        locationCode,
      })
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
  }, [drafts, pendingDraftKeys])

  React.useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSaveAll
    }
  }, [handleSaveAll, onSaveRef])

  async function handleDelete(assignment: RouteLocation) {
    const ok = await deleteRouteLocation(assignment.routeId, assignment.locationCode)
    if (!ok) return

    setAssignments((prev) =>
      prev.filter((item) => assignmentKey(item) !== assignmentKey(assignment))
    )
  }

  function startAdd() {
    const draftKey = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setAdding(true)
    setActiveAddDraftKey(draftKey)
    setDrafts((prev) => ({ ...prev, [draftKey]: { ...newAssignment, routeId: selectedRouteId } }))
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
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPendingDraftKeys((prev) => prev.filter((item) => item !== key))
    if (activeAddDraftKey === key) {
      setActiveAddDraftKey(null)
    }
  }

  function cancelEdit() {
    if (activeAddDraftKey) {
      removeDraft(activeAddDraftKey)
    }

    setAdding(false)
  }

  function updateDraft(key: string, draft: AssignmentDraft) {
    setDrafts((prev) => ({ ...prev, [key]: draft }))
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

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
                setNewAssignment((prev) => ({
                  ...prev,
                  routeId: e.target.value,
                }))
              }}
              className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
            >
              {routes.map((route) => (
                <option key={route.value} value={route.value}>
                  {route.value} — {route.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!selectedRouteId || products.length === 0 || adding}
            onClick={startAdd}
          >
            <PlusIcon className="size-3.5" />
            Add Route Location
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table className="text-xs min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Code", "Name", "Delivery", "Actions"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-center text-[11px] font-semibold tracking-wide py-2"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && activeAddDraftKey && drafts[activeAddDraftKey] && (
                <AssignmentEditRow
                  availableProducts={getAvailableProducts(drafts[activeAddDraftKey])}
                  draft={drafts[activeAddDraftKey]}
                  onDraftChange={(draft) => updateDraft(activeAddDraftKey, draft)}
                  onConfirm={confirmDraft}
                  onCancel={cancelEdit}
                />
              )}
              {pendingDraftKeys
                .filter((key) => !visibleAssignments.some((assignment) => assignmentKey(assignment) === key) && drafts[key])
                .map((key) => (
                  <TableRow key={key} className="h-10 bg-emerald-50/60 dark:bg-emerald-950/20">
                    <TableCell className="text-center py-1.5">
                      <span className="font-mono font-bold tracking-wider">
                        {drafts[key]?.locationCode}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      <span className="font-medium">
                        {productMap.get(drafts[key]?.locationCode ?? "")?.productName ?? "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground">
                      {productMap.get(drafts[key]?.locationCode ?? "")?.image || "-"}
                      <span className="ml-2 text-[10px] text-emerald-600 font-medium uppercase tracking-wide">
                        Pending Save
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex justify-center">
                        <ConfirmDeleteDialog
                          trigger={
                            <Button variant="destructive" size="sm">
                              Remove
                            </Button>
                          }
                          title="Remove pending location?"
                          description="This pending location draft will be discarded."
                          onConfirm={() => removeDraft(key)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {visibleAssignments.map((assignment) => {
                const key = assignmentKey(assignment)
                const location = productMap.get(assignment.locationCode)

                const pendingDraft = pendingDraftKeys.includes(key) ? drafts[key] : undefined
                const displayLocationCode = pendingDraft?.locationCode ?? assignment.locationCode
                const displayLocation = productMap.get(displayLocationCode)

                return (
                  <TableRow key={key} className="h-10">
                    <TableCell className="text-center py-1.5">
                      <span className="font-mono font-bold tracking-wider">
                        {displayLocationCode}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      <span className="font-medium">
                        {displayLocation?.productName ?? assignment.locationName ?? "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-1.5 text-muted-foreground">
                      {displayLocation?.image || assignment.delivery || "-"}
                      {pendingDraft && (
                        <span className="ml-2 text-[10px] text-emerald-600 font-medium uppercase tracking-wide">
                          Pending Save
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex justify-center">
                        <ConfirmDeleteDialog
                          trigger={
                            <Button variant="destructive" size="sm">
                              Remove
                            </Button>
                          }
                          title="Delete route location?"
                          description="This will remove the location assignment from the selected route."
                          onConfirm={() => handleDelete(assignment)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {selectedRouteId &&
                visibleAssignments.length === 0 &&
                !adding &&
                pendingDraftKeys.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No route locations assigned to this route yet.
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

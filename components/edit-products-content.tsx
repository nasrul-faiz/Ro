"use client"

import * as React from "react"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  SearchIcon,
  MapPinIcon,
  LocateIcon,
  ExternalLinkIcon,
  MoreVerticalIcon,
} from "lucide-react"
import {
  getProducts,
  replaceProducts,
  type Product,
  STARTING_POINT_CODE,
} from "@/lib/product-store"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { LoadingText } from "@/components/ui/loading-text"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"

const deliveryOptions = ["Daily", "WD", "Alt 1", "Alt 2", "WE", "WA"] as const

function compareByCode(a: Product, b: Product) {
  return a.productCode.localeCompare(b.productCode, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

// ─── Coordinate dialog ──────────────────────────────────────────────────────
interface CoordDialogProps {
  open: boolean
  title: string
  initialLat?: number
  initialLng?: number
  onClose: () => void
  onSave: (lat: number, lng: number) => void
}

function CoordDialog({ open, title, initialLat, initialLng, onClose, onSave }: CoordDialogProps) {
  const [lat, setLat] = React.useState(initialLat != null ? String(initialLat) : "")
  const [lng, setLng] = React.useState(initialLng != null ? String(initialLng) : "")
  const [geoLoading, setGeoLoading] = React.useState(false)
  const [geoError, setGeoError] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setLat(initialLat != null ? String(initialLat) : "")
      setLng(initialLng != null ? String(initialLng) : "")
      setGeoError("")
    }
  }, [open, initialLat, initialLng])

  function handleGetLocation() {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return }
    setGeoLoading(true)
    setGeoError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7))
        setLng(pos.coords.longitude.toFixed(7))
        setGeoLoading(false)
      },
      () => {
        setGeoError("Could not get location. Please enter manually.")
        setGeoLoading(false)
      }
    )
  }

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  const isValid = !isNaN(latNum) && !isNaN(lngNum)
  const mapsUrl = isValid ? `https://www.google.com/maps?q=${latNum},${lngNum}` : null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-sky-500" />
            {title}
          </DialogTitle>
          <DialogDescription>Enter the latitude and longitude for this location.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Latitude</label>
              <input
                type="number"
                step="any"
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 3.1390"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Longitude</label>
              <input
                type="number"
                step="any"
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. 101.6869"
              />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="gap-2 w-full"
            onClick={handleGetLocation} disabled={geoLoading}>
            <LocateIcon className="size-3.5" />
            {geoLoading ? "Getting location…" : "Use My Current Location"}
          </Button>

          {geoError && <p className="text-xs text-red-500">{geoError}</p>}

          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-sky-600 hover:underline">
              <ExternalLinkIcon className="size-3" />
              Preview on Google Maps
            </a>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white"
            disabled={!isValid} onClick={() => { onSave(latNum, lngNum); onClose() }}>
            Save Coordinates
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit row ───────────────────────────────────────────────────────────────
interface EditRowProps {
  draft: Product
  duplicateCode?: boolean
  onDraftChange: (product: Product) => void
  onConfirm: () => void
  onCancel: () => void
}

function EditRow({ draft, duplicateCode, onDraftChange, onConfirm, onCancel }: EditRowProps) {
  return (
    <TableRow className="bg-accent/20">
      <TableCell className="py-1.5 text-center">
        <input
          className={`${inputCls} ${duplicateCode ? "border-red-500 focus:ring-red-500" : ""}`}
          value={draft.productCode}
          onChange={(e) => onDraftChange({ ...draft, productCode: e.target.value.toUpperCase() })}
          placeholder="LOC-001"
        />
        {duplicateCode && (
          <p className="mt-1 text-left text-xs text-red-600">Duplicate code</p>
        )}
      </TableCell>
      <TableCell className="py-1.5">
        <input className={inputCls} value={draft.productName}
          onChange={(e) => onDraftChange({ ...draft, productName: e.target.value })}
          placeholder="Location name" />
      </TableCell>
      <TableCell className="py-1.5">
        <select className={inputCls} value={draft.image}
          onChange={(e) => onDraftChange({ ...draft, image: e.target.value })}>
          <option value="">Select delivery</option>
          {deliveryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </TableCell>
      <TableCell className="py-1.5 text-center text-muted-foreground/50 text-[11px] italic">
        Save first
      </TableCell>
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
interface EditProductsContentProps {
  onSaveRef?: React.MutableRefObject<(() => Promise<void>) | null>
  onDirtyChange?: (dirty: boolean) => void
}

export function EditProductsContent({ onSaveRef, onDirtyChange }: EditProductsContentProps) {
  const [products, setProducts] = React.useState<Product[]>([])          // regular locations
  const [startingPoint, setStartingPoint] = React.useState<Product | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, Product>>({})
  const [loading, setLoading] = React.useState(true)
  const [editingCode, setEditingCode] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [activeAddDraftKey, setActiveAddDraftKey] = React.useState<string | null>(null)
  const [pendingDraftKeys, setPendingDraftKeys] = React.useState<string[]>([])
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [contextDeleteTarget, setContextDeleteTarget] = React.useState<{ kind: "saved" | "pending"; code: string } | null>(null)

  // Coordinate drafts: productCode → { lat, lng }
  const [coordDrafts, setCoordDrafts] = React.useState<Record<string, { lat: number; lng: number }>>({})
  const [spCoord, setSpCoord] = React.useState<{ lat: number; lng: number } | null>(null)
  const [spCoordPending, setSpCoordPending] = React.useState(false)

  // Which coord dialog is open: productCode or '__START__' for starting point
  const [coordDialogTarget, setCoordDialogTarget] = React.useState<string | null>(null)

  React.useEffect(() => {
    getProducts().then((items) => {
      const sp = items.find((p) => p.isStartingPoint) ?? null
      const regular = items.filter((p) => !p.isStartingPoint)
      setStartingPoint(sp)
      setProducts(regular)
      setLoading(false)
    })
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const duplicateCodes = React.useMemo(() => {
    const counts = new Map<string, number>()

    // Existing products: use the live draft when one exists (whether it has
    // already been confirmed with the checkmark or is still being typed) so
    // collisions are caught immediately instead of only at save time. Each
    // existing product is counted exactly once here.
    for (const p of products) {
      const d = drafts[p.productCode] ?? p
      const code = d.productCode.trim().toUpperCase()
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1)
    }

    // Brand-new (not-yet-saved) drafts: confirmed pending ones plus the one
    // currently being typed in the "Add Location" row.
    const newKeys = new Set(pendingDraftKeys.filter((k) => !products.some((p) => p.productCode === k)))
    if (activeAddDraftKey) newKeys.add(activeAddDraftKey)

    for (const key of newKeys) {
      const code = drafts[key]?.productCode.trim().toUpperCase()
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1)
    }

    return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([c]) => c))
  }, [products, drafts, pendingDraftKeys, activeAddDraftKey])

  const sortedNewDraftKeys = React.useMemo(() =>
    pendingDraftKeys
      .filter((k) => !products.some((p) => p.productCode === k) && drafts[k])
      .sort((a, b) => (drafts[a]?.productCode ?? "").localeCompare(drafts[b]?.productCode ?? "", undefined, { numeric: true, sensitivity: "base" })),
    [drafts, pendingDraftKeys, products]
  )

  const sortedProducts = React.useMemo(() =>
    [...products].sort((a, b) => {
      const da = pendingDraftKeys.includes(a.productCode) ? drafts[a.productCode] : undefined
      const db = pendingDraftKeys.includes(b.productCode) ? drafts[b.productCode] : undefined
      return compareByCode(da ?? a, db ?? b)
    }),
    [drafts, pendingDraftKeys, products]
  )

  const filteredProducts = React.useMemo(() => {
    const kw = searchQuery.trim().toLowerCase()
    if (!kw) return sortedProducts
    return sortedProducts.filter((p) => {
      const d = pendingDraftKeys.includes(p.productCode) ? drafts[p.productCode] ?? p : p
      return d.productCode.toLowerCase().includes(kw) || d.productName.toLowerCase().includes(kw)
    })
  }, [drafts, pendingDraftKeys, searchQuery, sortedProducts])

  const filteredNewDraftKeys = React.useMemo(() => {
    const kw = searchQuery.trim().toLowerCase()
    if (!kw) return sortedNewDraftKeys
    return sortedNewDraftKeys.filter((k) => {
      const d = drafts[k]
      return d?.productCode.toLowerCase().includes(kw) || d?.productName.toLowerCase().includes(kw)
    })
  }, [drafts, searchQuery, sortedNewDraftKeys])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSaveAll = React.useCallback(async () => {
    setSaveError(null)
    if (pendingDraftKeys.length === 0 && !spCoordPending && Object.keys(coordDrafts).length === 0) return

    if (duplicateCodes.size > 0) {
      setSaveError(`Duplicate code(s): ${Array.from(duplicateCodes).join(", ")}`)
      return
    }

    // Build regular products payload
    const nextByCode = new Map<string, Product>()

    for (const p of products) {
      const draft = drafts[p.productCode]
      const base = draft ?? p
      const code = base.productCode.trim().toUpperCase()
      const name = base.productName.trim()
      if (!code || !name) continue
      const coords = coordDrafts[p.productCode] ?? (p.latitude != null ? { lat: p.latitude, lng: p.longitude! } : null)
      nextByCode.set(code, {
        productCode: code,
        productName: name,
        image: base.image.trim(),
        latitude: coords?.lat,
        longitude: coords?.lng,
        isStartingPoint: false,
      })
    }

    for (const key of pendingDraftKeys) {
      const draft = drafts[key]
      if (!draft || products.some((p) => p.productCode === key)) continue
      const code = draft.productCode.trim().toUpperCase()
      const name = draft.productName.trim()
      if (!code || !name) { setSaveError("Code and name required before saving"); return }
      if (!nextByCode.has(code)) {
        const coords = coordDrafts[code]
        nextByCode.set(code, {
          productCode: code,
          productName: name,
          image: draft.image.trim(),
          latitude: coords?.lat,
          longitude: coords?.lng,
          isStartingPoint: false,
        })
      }
    }

    const nextProducts = Array.from(nextByCode.values()).sort(compareByCode)

    // Include starting point in payload
    const effectiveSp = spCoord ?? (startingPoint?.latitude != null
      ? { lat: startingPoint.latitude!, lng: startingPoint.longitude! }
      : null)

    if (effectiveSp) {
      nextProducts.push({
        productCode: STARTING_POINT_CODE,
        productName: "QL Kitchen",
        image: "",
        latitude: effectiveSp.lat,
        longitude: effectiveSp.lng,
        isStartingPoint: true,
      })
    } else if (startingPoint) {
      nextProducts.push({
        productCode: STARTING_POINT_CODE,
        productName: "QL Kitchen",
        image: "",
        latitude: startingPoint.latitude,
        longitude: startingPoint.longitude,
        isStartingPoint: true,
      })
    }

    if (nextProducts.length === 0 && products.length > 0) {
      setSaveError("At least one valid location is required")
      return
    }

    const ok = await replaceProducts(nextProducts)
    if (ok) {
      const refreshed = await getProducts()
      setStartingPoint(refreshed.find((p) => p.isStartingPoint) ?? null)
      setProducts(refreshed.filter((p) => !p.isStartingPoint))
      setDrafts({})
      setAdding(false)
      setEditingCode(null)
      setActiveAddDraftKey(null)
      setPendingDraftKeys([])
      setCoordDrafts({})
      setSpCoord(null)
      setSpCoordPending(false)
    } else {
      setSaveError("Failed to save. Your pending edits were kept.")
    }
  }, [drafts, duplicateCodes, pendingDraftKeys, products, startingPoint, spCoord, spCoordPending, coordDrafts])

  React.useEffect(() => {
    if (onSaveRef) onSaveRef.current = handleSaveAll
  }, [handleSaveAll, onSaveRef])

  const hasChanges = pendingDraftKeys.length > 0 || spCoordPending || Object.keys(coordDrafts).length > 0

  React.useEffect(() => {
    onDirtyChange?.(hasChanges)
  }, [hasChanges, onDirtyChange])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleDelete(productCode: string) {
    const res = await fetch(`/api/products?product_code=${encodeURIComponent(productCode)}`, { method: "DELETE" })
    if (!res.ok) return
    setProducts((prev) => prev.filter((p) => p.productCode !== productCode))
  }

  function startAdd() {
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setAdding(true)
    setEditingCode(null)
    setActiveAddDraftKey(key)
    setDrafts((prev) => ({ ...prev, [key]: { productCode: "", productName: "", image: "" } }))
  }

  function startEdit(code: string) {
    const product = products.find((p) => p.productCode === code)
    if (product) {
      setEditingCode(code)
      // Preserve an already-staged (but unsaved) edit for this row instead of
      // reverting it back to the original values when re-opening for edit.
      setDrafts((prev) => ({ ...prev, [code]: prev[code] ?? { ...product } }))
    }
  }

  function confirmDraft() {
    setSaveError(null)
    if (adding && activeAddDraftKey && drafts[activeAddDraftKey]) {
      const key = activeAddDraftKey
      setPendingDraftKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
      setAdding(false)
      setActiveAddDraftKey(null)
      return
    }
    if (editingCode && drafts[editingCode]) {
      setPendingDraftKeys((prev) => (prev.includes(editingCode) ? prev : [...prev, editingCode]))
      setEditingCode(null)
    }
  }

  function removeDraft(key: string) {
    setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n })
    setPendingDraftKeys((prev) => prev.filter((k) => k !== key))
    if (activeAddDraftKey === key) setActiveAddDraftKey(null)
  }

  function cancelEdit() {
    if (activeAddDraftKey) removeDraft(activeAddDraftKey)
    if (editingCode) removeDraft(editingCode)
    setEditingCode(null)
    setAdding(false)
  }

  // ── Coord dialog helpers ───────────────────────────────────────────────────
  function getCoordDialogProps() {
    if (!coordDialogTarget) return null
    if (coordDialogTarget === STARTING_POINT_CODE) {
      const eff = spCoord ?? (startingPoint?.latitude != null ? { lat: startingPoint.latitude!, lng: startingPoint.longitude! } : null)
      return { title: "Set QL Kitchen Coordinates", lat: eff?.lat, lng: eff?.lng }
    }
    const effCoord = coordDrafts[coordDialogTarget]
    const savedProduct = products.find((p) => p.productCode === coordDialogTarget)
    const lat = effCoord?.lat ?? savedProduct?.latitude
    const lng = effCoord?.lng ?? savedProduct?.longitude
    return { title: `Set Coordinates — ${coordDialogTarget}`, lat, lng }
  }

  function handleCoordSave(lat: number, lng: number) {
    if (!coordDialogTarget) return
    if (coordDialogTarget === STARTING_POINT_CODE) {
      setSpCoord({ lat, lng })
      setSpCoordPending(true)
    } else {
      setCoordDrafts((prev) => ({ ...prev, [coordDialogTarget]: { lat, lng } }))
    }
  }

  const coordProps = getCoordDialogProps()

  // ── Coord button renderer ─────────────────────────────────────────────────
  function CoordButton({ code, lat, lng }: { code: string; lat?: number; lng?: number }) {
    const isStartingPoint = code === STARTING_POINT_CODE
    const hasPending = isStartingPoint ? spCoordPending : !!coordDrafts[code]
    const hasCoords = lat != null && lng != null
    return (
      <button
        onClick={() => setCoordDialogTarget(code)}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors
          ${hasCoords
            ? isStartingPoint
              ? "border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40"
              : "border-border text-foreground bg-muted/40 hover:bg-muted/60"
            : isStartingPoint
              ? "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-sky-400 hover:text-sky-600"
              : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
      >
        <MapPinIcon className="size-3" />
        {hasCoords
          ? <span>{lat!.toFixed(4)}, {lng!.toFixed(4)}</span>
          : <span>Set Coords</span>}
        {hasPending && <span className="ml-1 text-[9px] text-emerald-600 font-bold uppercase">•</span>}
      </button>
    )
  }

  if (loading) return <LoadingText />

  const hasPendingChanges = pendingDraftKeys.length > 0 || spCoordPending || Object.keys(coordDrafts).length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Coord dialog */}
      {coordDialogTarget && coordProps && (
        <CoordDialog
          open={true}
          title={coordProps.title}
          initialLat={coordProps.lat}
          initialLng={coordProps.lng}
          onClose={() => setCoordDialogTarget(null)}
          onSave={(lat, lng) => { handleCoordSave(lat, lng); setCoordDialogTarget(null) }}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} location{products.length !== 1 && "s"} in master list
          {hasPendingChanges && (
            <span className="ml-2 text-[11px] text-emerald-600 font-medium uppercase tracking-wide">
              • Unsaved changes
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-[220px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location..." className="h-8 pl-8 text-xs" />
          </div>
          <Button size="sm" className="gap-1.5" onClick={startAdd}
            disabled={editingCode !== null || adding}>
            <PlusIcon className="size-3.5" />
            Add Location
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden text-xs">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Code", "Name", "Delivery", "Coordinates", "Actions"].map((h) => (
                <TableHead key={h}
                  className="text-center text-[11px] font-semibold tracking-wide py-2">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ── Starting Point row (always shown) ─────────────────────── */}
            {(() => {
              const effLat = spCoord?.lat ?? startingPoint?.latitude
              const effLng = spCoord?.lng ?? startingPoint?.longitude
              return (
                <TableRow className="h-10 bg-sky-50/70 dark:bg-sky-950/20 border-b border-sky-200/50 dark:border-sky-800/40">
                  <TableCell className="text-center py-1.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-400 text-[11px]">
                      <MapPinIcon className="size-3" />
                      QLK
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-center font-medium text-sky-700 dark:text-sky-400">
                    QL Kitchen
                    {spCoordPending && (
                      <span className="ml-2 text-[10px] text-emerald-600 font-medium uppercase">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-center text-muted-foreground/40 italic text-[11px]">
                    —
                  </TableCell>
                  <TableCell className="py-1.5 text-center">
                    <CoordButton code={STARTING_POINT_CODE} lat={effLat} lng={effLng} />
                  </TableCell>
                  <TableCell className="py-1.5 text-center text-[10px] text-muted-foreground/50 italic">
                    Origin
                  </TableCell>
                </TableRow>
              )
            })()}

            {/* ── Add row ────────────────────────────────────────────────── */}
            {adding && activeAddDraftKey && drafts[activeAddDraftKey] && (
              <EditRow
                draft={drafts[activeAddDraftKey]}
                duplicateCode={duplicateCodes.has(drafts[activeAddDraftKey].productCode.trim().toUpperCase())}
                onDraftChange={(p) => setDrafts((prev) => ({ ...prev, [activeAddDraftKey]: p }))}
                onConfirm={confirmDraft}
                onCancel={cancelEdit}
              />
            )}

            {/* ── Pending new drafts ──────────────────────────────────────── */}
            {filteredNewDraftKeys.map((key) => {
              const draft = drafts[key]
              if (!draft) return null
              const code = draft.productCode.trim().toUpperCase()
              const hasDup = code ? duplicateCodes.has(code) : false
              return (
                <ContextMenu key={key}>
                  <ContextMenuTrigger asChild>
                    <TableRow className="h-10 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <TableCell className={`py-1.5 text-center font-mono ${hasDup ? "text-red-600" : ""}`}>
                        {draft.productCode}
                        {hasDup && <span className="ml-1 text-[10px] text-red-600 font-medium">Dup</span>}
                      </TableCell>
                      <TableCell className="py-1.5 text-center font-medium">{draft.productName}</TableCell>
                      <TableCell className="py-1.5 text-center">{draft.image || "-"}</TableCell>
                      <TableCell className="py-1.5 text-center text-muted-foreground/40 italic text-[11px]">Save first</TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                                <MoreVerticalIcon className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setAdding(true); setEditingCode(null); setActiveAddDraftKey(key) }}>
                                <PencilIcon />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setContextDeleteTarget({ kind: "pending", code: key })}
                              >
                                <Trash2Icon />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuGroup>
                      <ContextMenuItem onClick={() => { setAdding(true); setEditingCode(null); setActiveAddDraftKey(key) }}>
                        <PencilIcon />
                        Edit
                      </ContextMenuItem>
                    </ContextMenuGroup>
                    <ContextMenuSeparator />
                    <ContextMenuGroup>
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => setContextDeleteTarget({ kind: "pending", code: key })}
                      >
                        <Trash2Icon />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuGroup>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}

            {/* ── Saved products ──────────────────────────────────────────── */}
            {filteredProducts.map((item) => {
              if (editingCode === item.productCode && drafts[item.productCode]) {
                return (
                  <EditRow key={item.productCode}
                    draft={drafts[item.productCode]}
                    duplicateCode={duplicateCodes.has(drafts[item.productCode].productCode.trim().toUpperCase())}
                    onDraftChange={(p) => setDrafts((prev) => ({ ...prev, [item.productCode]: p }))}
                    onConfirm={confirmDraft}
                    onCancel={cancelEdit}
                  />
                )
              }

              const pendingDraft = pendingDraftKeys.includes(item.productCode) ? drafts[item.productCode] : undefined
              const display = pendingDraft ?? item
              const effCoord = coordDrafts[item.productCode]
              const lat = effCoord?.lat ?? item.latitude
              const lng = effCoord?.lng ?? item.longitude
              const isPending = !!pendingDraft || !!effCoord

              return (
                <ContextMenu key={item.productCode}>
                  <ContextMenuTrigger asChild>
                    <TableRow className={`h-10 ${isPending ? "text-orange-800 dark:text-orange-300" : ""}`}>
                      <TableCell className="text-center py-1.5 font-mono text-muted-foreground">
                        {display.productCode}
                        {isPending && <span className="ml-1 text-[10px] text-emerald-600 font-medium uppercase">•</span>}
                      </TableCell>
                      <TableCell className="py-1.5 text-center font-medium truncate max-w-[200px]">
                        {display.productName}
                      </TableCell>
                      <TableCell className="py-1.5 text-center text-muted-foreground">
                        {display.image || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 text-center">
                        <CoordButton code={item.productCode} lat={lat} lng={lng} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                                <MoreVerticalIcon className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startEdit(item.productCode)}>
                                <PencilIcon />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setContextDeleteTarget({ kind: "saved", code: item.productCode })}
                              >
                                <Trash2Icon />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuGroup>
                      <ContextMenuItem onClick={() => startEdit(item.productCode)}>
                        <PencilIcon />
                        Edit
                      </ContextMenuItem>
                    </ContextMenuGroup>
                    <ContextMenuSeparator />
                    <ContextMenuGroup>
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => setContextDeleteTarget({ kind: "saved", code: item.productCode })}
                      >
                        <Trash2Icon />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuGroup>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}

            {products.length === 0 && !adding && pendingDraftKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No locations yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDeleteDialog
        open={!!contextDeleteTarget}
        onOpenChange={(o) => { if (!o) setContextDeleteTarget(null) }}
        title={contextDeleteTarget?.kind === "pending" ? "Remove pending location?" : "Delete location?"}
        description={
          contextDeleteTarget?.kind === "pending"
            ? "This pending draft will be discarded."
            : "This will permanently delete this location."
        }
        onConfirm={() => {
          if (!contextDeleteTarget) return
          if (contextDeleteTarget.kind === "pending") removeDraft(contextDeleteTarget.code)
          else handleDelete(contextDeleteTarget.code)
          setContextDeleteTarget(null)
        }}
      />
    </div>
  )
}

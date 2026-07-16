"use client"

import * as React from "react"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  SearchIcon,
} from "lucide-react"
import { getProducts, replaceProducts, type Product } from "@/lib/product-store"
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

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"

const deliveryOptions = ["Daily", "WD", "Alt 1", "Alt 2", "WE", "WA"] as const

function compareProductsByCode(a: Product, b: Product) {
  return a.productCode.localeCompare(b.productCode, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

interface EditRowProps {
  draft: Product
  onDraftChange: (product: Product) => void
  onConfirm: () => void
  onCancel: () => void
}

function EditRow({
  draft,
  duplicateCode,
  onDraftChange,
  onConfirm,
  onCancel,
}: EditRowProps & { duplicateCode?: boolean }) {
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
          <p className="mt-1 text-left text-xs text-red-600">
            Duplicate code detected
          </p>
        )}
      </TableCell>
      <TableCell className="py-1.5">
        <input
          className={inputCls}
          value={draft.productName}
          onChange={(e) => onDraftChange({ ...draft, productName: e.target.value })}
          placeholder="Location name"
        />
      </TableCell>
      <TableCell className="py-1.5">
        <select
          className={inputCls}
          value={draft.image}
          onChange={(e) => onDraftChange({ ...draft, image: e.target.value })}
        >
          <option value="">Select delivery</option>
          {deliveryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </TableCell>
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

interface EditProductsContentProps {
  onSaveRef?: React.MutableRefObject<(() => Promise<void>) | null>
}

export function EditProductsContent({ onSaveRef }: EditProductsContentProps) {
  const [products, setProducts] = React.useState<Product[]>([])
  const [drafts, setDrafts] = React.useState<Record<string, Product>>({})
  const [loading, setLoading] = React.useState(true)
  const [editingCode, setEditingCode] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [activeAddDraftKey, setActiveAddDraftKey] = React.useState<string | null>(null)
  const [pendingDraftKeys, setPendingDraftKeys] = React.useState<string[]>([])
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  React.useEffect(() => {
    getProducts().then((items) => {
      setProducts(items)
      setLoading(false)
    })
  }, [])

  const allProductRows = React.useMemo(() => {
    const rows: Product[] = []

    for (const product of products) {
      rows.push(drafts[product.productCode] ?? product)
    }

    for (const key of pendingDraftKeys) {
      if (!products.some((product) => product.productCode === key)) {
        const draft = drafts[key]
        if (draft) {
          rows.push(draft)
        }
      }
    }

    if (activeAddDraftKey && drafts[activeAddDraftKey]) {
      rows.push(drafts[activeAddDraftKey])
    }

    return rows
  }, [products, drafts, pendingDraftKeys, activeAddDraftKey])

  const duplicateProductCodes = React.useMemo(() => {
    const counts = new Map<string, number>()

    for (const product of allProductRows) {
      const code = product.productCode.trim().toUpperCase()
      if (!code) continue
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([code]) => code)
    )
  }, [allProductRows])

  const sortedPendingDraftKeys = React.useMemo(
    () =>
      pendingDraftKeys
        .filter((key) => !products.some((product) => product.productCode === key) && drafts[key])
        .sort((leftKey, rightKey) => {
          const leftCode = drafts[leftKey]?.productCode ?? ""
          const rightCode = drafts[rightKey]?.productCode ?? ""

          return leftCode.localeCompare(rightCode, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        }),
    [drafts, pendingDraftKeys, products]
  )

  const sortedProducts = React.useMemo(() => {
    return [...products].sort((leftItem, rightItem) => {
      const leftDraft = pendingDraftKeys.includes(leftItem.productCode)
        ? drafts[leftItem.productCode]
        : undefined
      const rightDraft = pendingDraftKeys.includes(rightItem.productCode)
        ? drafts[rightItem.productCode]
        : undefined

      return compareProductsByCode(leftDraft ?? leftItem, rightDraft ?? rightItem)
    })
  }, [drafts, pendingDraftKeys, products])

  const filteredSortedProducts = React.useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return sortedProducts

    return sortedProducts.filter((item) => {
      const displayItem = pendingDraftKeys.includes(item.productCode)
        ? drafts[item.productCode] ?? item
        : item

      return (
        displayItem.productCode.toLowerCase().includes(keyword) ||
        displayItem.productName.toLowerCase().includes(keyword)
      )
    })
  }, [drafts, pendingDraftKeys, searchQuery, sortedProducts])

  const filteredSortedPendingDraftKeys = React.useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return sortedPendingDraftKeys

    return sortedPendingDraftKeys.filter((key) => {
      const draft = drafts[key]
      if (!draft) return false

      return (
        draft.productCode.toLowerCase().includes(keyword) ||
        draft.productName.toLowerCase().includes(keyword)
      )
    })
  }, [drafts, searchQuery, sortedPendingDraftKeys])

  const handleSaveAll = React.useCallback(async () => {
    setSaveError(null)
    if (pendingDraftKeys.length === 0) return

    if (duplicateProductCodes.size > 0) {
      setSaveError(
        `Duplicate location code${duplicateProductCodes.size > 1 ? "s" : ""}: ${
          Array.from(duplicateProductCodes).join(", ")
        }`
      )
      return
    }

    const nextByCode = new Map<string, Product>()

    for (const product of products) {
      const edited = drafts[product.productCode] ?? product
      const code = edited.productCode.trim().toUpperCase()
      const name = edited.productName.trim()
      if (!code || !name) continue

      if (!nextByCode.has(code)) {
        nextByCode.set(code, {
          productCode: code,
          productName: name,
          image: edited.image.trim(),
        })
      }
    }

    for (const key of pendingDraftKeys) {
      const draft = drafts[key]
      if (!draft) continue
      if (products.some((product) => product.productCode === key)) continue

      const code = draft.productCode.trim().toUpperCase()
      const name = draft.productName.trim()
      if (code && name && !nextByCode.has(code)) {
        nextByCode.set(code, {
          productCode: code,
          productName: name,
          image: draft.image.trim(),
        })
      } else if (!code || !name) {
        setSaveError("Location code and name are required before saving")
        return
      }
    }

    const nextProducts = Array.from(nextByCode.values()).sort((a, b) =>
      a.productCode.localeCompare(b.productCode, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    )

    if (nextProducts.length === 0 && products.length > 0) {
      setSaveError("At least one valid location is required to save changes")
      return
    }

    const ok = await replaceProducts(nextProducts)
    if (ok) {
      setProducts(nextProducts)
      setDrafts({})
      setAdding(false)
      setEditingCode(null)
      setActiveAddDraftKey(null)
      setPendingDraftKeys([])
    } else {
      setSaveError("Failed to save locations. Your pending edits were kept.")
    }
  }, [drafts, duplicateProductCodes, pendingDraftKeys, products])

  React.useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSaveAll
    }
  }, [handleSaveAll, onSaveRef])

  async function handleDelete(productCode: string) {
    const response = await fetch(
      `/api/products?product_code=${encodeURIComponent(productCode)}`,
      { method: "DELETE" }
    )
    if (!response.ok) return
    setProducts((prev) => prev.filter((p) => p.productCode !== productCode))
  }

  function startAdd() {
    const draftKey = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setAdding(true)
    setEditingCode(null)
    setActiveAddDraftKey(draftKey)
    setDrafts((prev) => ({ ...prev, [draftKey]: { productCode: "", productName: "", image: "" } }))
  }

  function startEdit(code: string) {
    const product = products.find((p) => p.productCode === code)
    if (product) {
      setEditingCode(code)
      setDrafts((prev) => ({ ...prev, [code]: { ...product } }))
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

    if (editingCode) {
      removeDraft(editingCode)
    }

    setEditingCode(null)
    setAdding(false)
  }

  function updateDraft(code: string, product: Product) {
    setSaveError(null)
    setDrafts((prev) => ({ ...prev, [code]: product }))
  }

  if (loading) {
    return <LoadingText />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} location{products.length !== 1 && "s"} in master list
        </p>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-[220px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={startAdd}
            disabled={editingCode !== null || adding}
          >
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
              <EditRow
                draft={drafts[activeAddDraftKey]}
                duplicateCode={duplicateProductCodes.has(
                  drafts[activeAddDraftKey].productCode.trim().toUpperCase()
                )}
                onDraftChange={(p) => updateDraft(activeAddDraftKey, p)}
                onConfirm={confirmDraft}
                onCancel={cancelEdit}
              />
            )}
            {filteredSortedPendingDraftKeys.map((key) => {
                const draft = drafts[key]
                if (!draft) return null
                const normalizedCode = draft.productCode.trim().toUpperCase()
                const hasDuplicate = normalizedCode ? duplicateProductCodes.has(normalizedCode) : false

                return (
                  <TableRow key={key} className="h-10 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                    <TableCell className={`py-1.5 text-center font-mono ${hasDuplicate ? "bg-red-50/80 text-red-700" : ""}`}>
                      {draft.productCode}
                      {hasDuplicate && (
                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-red-600">
                          Duplicate
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      <span className="max-w-[200px] truncate font-medium">
                        {draft.productName}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {draft.image || "-"}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => {
                            setAdding(true)
                            setEditingCode(null)
                            setActiveAddDraftKey(key)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                        <ConfirmDeleteDialog
                          trigger={
                            <button className="rounded p-1 text-muted-foreground hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40">
                              <Trash2Icon className="size-3.5" />
                            </button>
                          }
                          title="Remove pending location?"
                          description="This pending location draft will be discarded."
                          onConfirm={() => removeDraft(key)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            {filteredSortedProducts.map((item) => {
              if (editingCode === item.productCode && drafts[item.productCode]) {
                const normalizedCode = drafts[item.productCode].productCode.trim().toUpperCase()
                return (
                  <EditRow
                    key={item.productCode}
                    draft={drafts[item.productCode]}
                    duplicateCode={duplicateProductCodes.has(normalizedCode)}
                    onDraftChange={(p) => updateDraft(item.productCode, p)}
                    onConfirm={confirmDraft}
                    onCancel={cancelEdit}
                  />
                )
              }

              const pendingDraft = pendingDraftKeys.includes(item.productCode)
                ? drafts[item.productCode]
                : undefined
              const displayItem = pendingDraft ?? item
              const normalizedCode = displayItem.productCode.trim().toUpperCase()
              const hasDuplicate = normalizedCode ? duplicateProductCodes.has(normalizedCode) : false
              const rowClass = pendingDraft
                ? "h-10 text-orange-800 dark:text-orange-300"
                : "h-10"
              const mutedCellClass = pendingDraft ? "" : "text-muted-foreground"
              return (
                <TableRow key={item.productCode} className={rowClass}>
                  <TableCell className={`text-center py-1.5 font-mono ${hasDuplicate ? "bg-red-50/80 text-red-700" : mutedCellClass}`}>
                    {displayItem.productCode}
                    {hasDuplicate && (
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-red-600">
                        Duplicate
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-center">
                    <span className="font-medium truncate max-w-[200px]">
                      {displayItem.productName}
                    </span>
                  </TableCell>
                  <TableCell className={`py-1.5 text-center ${mutedCellClass}`}>
                    {displayItem.image || "-"}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => startEdit(item.productCode)}
                        className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                      <ConfirmDeleteDialog
                        trigger={
                          <button
                            className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2Icon className="size-3.5" />
                          </button>
                        }
                        title="Delete location?"
                        description="This will permanently delete this location."
                        onConfirm={() => handleDelete(item.productCode)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {products.length === 0 && !adding && pendingDraftKeys.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No locations yet.
                </TableCell>
              </TableRow>
            )}
            {products.length > 0 &&
              searchQuery.trim() !== "" &&
              filteredSortedProducts.length === 0 &&
              filteredSortedPendingDraftKeys.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No locations match &ldquo;{searchQuery}&rdquo;.
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

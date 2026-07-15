"use client"

import * as React from "react"
import { ClipboardListIcon } from "lucide-react"
import { ImageLightbox } from "@/components/image-lightbox"
import { getAllDOs, DELIVERY_ORDERS_STORAGE_KEY, DELIVERY_ORDERS_UPDATED_EVENT, type DeliveryOrder } from "@/lib/do-store"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface RefillItem {
  slot: string
  productCode: string
  productName: string
  image: string
  stockIn: number
  overflow: number
  stockOut: number
  currentInventory: number
  maxCapacity: number
}

interface RowValues {
  stockIn: number
  overflow: number
  stockOut: number
}

interface RefillTableProps {
  machineId: string
  items: RefillItem[]
  prefilledStockIn?: Record<string, number>
  isEditable?: boolean
  onValuesChange?: (values: Record<string, RowValues>) => void
}

const inputCls =
  "w-16 rounded-md border bg-background px-1.5 py-1 text-center text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"

export function RefillTable({ machineId, items, prefilledStockIn, isEditable = true, onValuesChange }: RefillTableProps) {
  const [allOrders, setAllOrders] = React.useState<DeliveryOrder[]>([])
  const [isViewDOpen, setIsViewDOOpen] = React.useState(false)

  React.useEffect(() => {
    async function reloadOrders() {
      const orders = await getAllDOs()
      setAllOrders(orders)
    }

    reloadOrders()

    function handleStorage(event: StorageEvent) {
      if (event.key === DELIVERY_ORDERS_STORAGE_KEY) {
        reloadOrders()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(DELIVERY_ORDERS_UPDATED_EVENT, reloadOrders)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(DELIVERY_ORDERS_UPDATED_EVENT, reloadOrders)
    }
  }, [])

  const todayKey = new Date().toISOString().slice(0, 10)
  const todaysOrders = React.useMemo(
    () =>
      allOrders.filter(
        (order) => order.machineId === machineId && order.date.slice(0, 10) === todayKey
      ),
    [allOrders, machineId, todayKey]
  )

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
          map.set(key, {
            slot: item.slot,
            productCode: item.productCode,
            productName: item.productName,
            qty: item.qty,
          })
        }
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      a.slot.localeCompare(b.slot, undefined, { numeric: true, sensitivity: "base" })
    )
  }, [todaysOrders])
  const readonlyInputCls = !isEditable
    ? "text-muted-foreground disabled:text-muted-foreground disabled:opacity-100"
    : ""

  const sortedItems = React.useMemo(
    () =>
      [...items].sort((a, b) =>
        a.slot.localeCompare(b.slot, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [items]
  )

  const itemMap = React.useMemo(
    () => Object.fromEntries(items.map((i) => [i.slot, i])),
    [items]
  )

  const calcOverflow = (slot: string, stockIn: number) => {
    const item = itemMap[slot]
    if (!item) return 0
    const available = item.maxCapacity - item.currentInventory
    return Math.max(0, stockIn - available)
  }

  const [values, setValues] = React.useState<Record<string, RowValues>>(
    () =>
      Object.fromEntries(
        items.map((item) => {
          const stockIn = prefilledStockIn?.[item.slot] ?? item.stockIn
          const available = item.maxCapacity - item.currentInventory
          const overflow = prefilledStockIn?.[item.slot] != null
            ? Math.max(0, stockIn - available)
            : item.overflow
          return [item.slot, { stockIn, overflow, stockOut: item.stockOut }]
        })
      )
  )

  React.useEffect(() => {
    onValuesChange?.(values)
  }, [values, onValuesChange])

  function handleChange(slot: string, field: keyof RowValues, raw: string) {
    const num = raw === "" ? 0 : Math.max(0, parseInt(raw) || 0)
    setValues((prev) => {
      const item = itemMap[slot]
      const baseStockIn = prefilledStockIn?.[slot] ?? item?.stockIn ?? 0
      const baseOverflow = prefilledStockIn?.[slot] != null
        ? calcOverflow(slot, baseStockIn)
        : (item?.overflow ?? 0)
      const baseStockOut = item?.stockOut ?? 0
      const current = prev[slot] ?? {
        stockIn: baseStockIn,
        overflow: baseOverflow,
        stockOut: baseStockOut,
      }
      const updated = { ...current, [field]: num }
      if (field === "stockIn") {
        updated.overflow = calcOverflow(slot, num)
      }
      return { ...prev, [slot]: updated }
    })
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden text-xs">
      {/* Header bar */}
      <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/40">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
          {machineId}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{items.length} slots</span>
          <Button
            type="button"
            size="sm"
            disabled={todaysOrders.length === 0}
            onClick={() => setIsViewDOOpen(true)}
            className={`h-7 text-[11px] gap-1.5 px-2.5 ${todaysOrders.length > 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            variant={todaysOrders.length > 0 ? "default" : "outline"}
          >
            <ClipboardListIcon className="size-3.5" />
            View DO
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <Table className="text-xs min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {["Slot", "Stock In", "Overflow", "Stock Out", "Inventory", "", "Product Name", "Max"].map(
              (h, i) => (
                <TableHead
                  key={i}
                  className="text-center text-[11px] font-semibold tracking-wide py-2"
                >
                  {h}
                </TableHead>
              )
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedItems.map((item) => {
            const baseStockIn = prefilledStockIn?.[item.slot] ?? item.stockIn
            const baseOverflow = prefilledStockIn?.[item.slot] != null
              ? calcOverflow(item.slot, baseStockIn)
              : item.overflow
            const row = values[item.slot] ?? {
              stockIn: baseStockIn,
              overflow: baseOverflow,
              stockOut: item.stockOut,
            }
            return (
              <TableRow key={item.slot} className="h-10">
                {/* Slot */}
                <TableCell className="text-center py-1.5">
                  <span className="font-mono font-bold tracking-wider">{item.slot}</span>
                </TableCell>

                {/* Stock In */}
                <TableCell className="text-center py-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={!isEditable}
                    value={row.stockIn === 0 ? "" : row.stockIn}
                    placeholder="0"
                    onChange={(e) => handleChange(item.slot, "stockIn", e.target.value)}
                    className={`${inputCls} ${readonlyInputCls} ${prefilledStockIn?.[item.slot] != null ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-300" : ""}`}
                  />
                </TableCell>

                {/* Overflow */}
                <TableCell className="text-center py-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={!isEditable}
                    value={row.overflow === 0 ? "" : row.overflow}
                    placeholder="0"
                    onChange={(e) => handleChange(item.slot, "overflow", e.target.value)}
                    className={`${inputCls} ${readonlyInputCls}`}
                  />
                </TableCell>

                {/* Stock Out */}
                <TableCell className="text-center py-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={!isEditable}
                    value={row.stockOut === 0 ? "" : row.stockOut}
                    placeholder="0"
                    onChange={(e) => handleChange(item.slot, "stockOut", e.target.value)}
                    className={`${inputCls} ${readonlyInputCls}`}
                  />
                </TableCell>

                {/* Inventory */}
                <TableCell className="text-center py-1.5 font-semibold tabular-nums">
                  {item.currentInventory}
                </TableCell>

                {/* Image */}
                <TableCell className="text-center py-1.5 px-1.5">
                  <div className="h-8 w-8 mx-auto rounded-md overflow-hidden border bg-muted">
                    {item.image ? (
                      <ImageLightbox src={item.image} alt={item.productName}>
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </ImageLightbox>
                    ) : null}
                  </div>
                </TableCell>

                {/* Product Name */}
                <TableCell className="text-center py-1.5 max-w-[180px]">
                  <p className="truncate font-medium">{item.productName}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{item.productCode}</p>
                </TableCell>

                {/* Max */}
                <TableCell className="text-center py-1.5 text-muted-foreground tabular-nums">
                  {item.maxCapacity}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>

      <Dialog open={isViewDOpen} onOpenChange={setIsViewDOOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>DO List Today - {machineId}</DialogTitle>
            <DialogDescription>
              {todaysOrders.length} generated DO(s) with {todaysItemSummary.length} item line(s).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table className="text-xs min-w-[620px]">
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
                      No orders for this machine today.
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

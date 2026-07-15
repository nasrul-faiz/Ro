"use client"

import * as React from "react"
import Image from "next/image"
import {
  ShoppingCartIcon,
  PrinterIcon,
  CheckCircleIcon,
  CalendarIcon,
  HashIcon,
  TruckIcon,
} from "lucide-react"
import { FieldSelect } from "@/components/field-select"
import { getMachines } from "@/lib/machine-store"
import { getRefillData, REFILL_DATA_STORAGE_KEY, type RefillDataMap } from "@/lib/refill-store"
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
  generateDOCode,
  saveDO,
  type DeliveryOrder,
} from "@/lib/do-store"

const inputCls =
  "w-16 rounded-md border bg-background px-1.5 py-1 text-center text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"

export function OrderingContent() {
  const [selectedMachine, setSelectedMachine] = React.useState("")
  const [machines, setMachines] = React.useState<Array<{ value: string; label: string }>>([])
  const [refillData, setRefillData] = React.useState<RefillDataMap>({})
  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [submittedDO, setSubmittedDO] = React.useState<DeliveryOrder | null>(null)

  React.useEffect(() => {
    Promise.all([getMachines(), getRefillData()]).then(([m, r]) => {
      setMachines(m)
      setRefillData(r)
    })

    function handleStorage(event: StorageEvent) {
      if (event.key === REFILL_DATA_STORAGE_KEY) {
        getRefillData().then(setRefillData)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const items = React.useMemo(
    () => (selectedMachine ? refillData[selectedMachine] ?? [] : []),
    [selectedMachine, refillData]
  )
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
  const machineLabel =
    machines.find((m) => m.value === selectedMachine)?.label ?? selectedMachine

  function handleMachineChange(value: string) {
    setSelectedMachine(value)
    setQuantities({})
    setSubmittedDO(null)
  }

  function handleQtyChange(slot: string, raw: string) {
    const num = raw === "" ? 0 : Math.max(0, parseInt(raw) || 0)
    setQuantities((prev) => ({ ...prev, [slot]: num }))
  }

  const orderedItems = sortedItems
    .map((item) => ({ ...item, qty: quantities[item.slot] ?? 0 }))
    .filter((item) => item.qty > 0)

  const totalQty = orderedItems.reduce((a, b) => a + b.qty, 0)

  function handleSubmit() {
    const code = generateDOCode()
    const now = new Date()
    const order: DeliveryOrder = {
      code,
      machineId: selectedMachine,
      machineLabel,
      date: now.toISOString(),
      items: orderedItems.map((item) => ({
        slot: item.slot,
        productCode: item.productCode,
        productName: item.productName,
        qty: item.qty,
      })),
      status: "pending",
    }
    saveDO(order).then(() => {
      setSubmittedDO(order)
    })
  }

  function handleNewOrder() {
    setSubmittedDO(null)
    setSelectedMachine("")
    setQuantities({})
  }

  if (submittedDO) {
    return <DODocument order={submittedDO} onNewOrder={handleNewOrder} />
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldSelect value={selectedMachine} onChange={handleMachineChange} />

      {selectedMachine && items.length > 0 && (
        <>
          <div className="rounded-xl border bg-card overflow-hidden text-xs">
            <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/40">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
                {selectedMachine} — Order Sheet
              </span>
              <span className="text-[11px] text-muted-foreground">
                {items.length} products
              </span>
            </div>

            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Slot", "", "Product Name", "Stock", "Max", "Order Qty"].map(
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
                  const qty = quantities[item.slot] ?? 0
                  const isLow = item.currentInventory < item.maxCapacity * 0.3
                  return (
                    <TableRow key={item.slot} className="h-10">
                      <TableCell className="text-center py-1.5">
                        <span className="font-mono font-bold tracking-wider">
                          {item.slot}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-1.5 px-1.5">
                        <div className="relative h-8 w-8 mx-auto rounded-md overflow-hidden border bg-muted">
                          {item.image && (
                            <Image
                              src={item.image}
                              alt={item.productName}
                              fill
                              className="object-cover"
                              sizes="32px"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-1.5 max-w-[180px]">
                        <p className="truncate font-medium">{item.productName}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {item.productCode}
                        </p>
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <span
                          className={`font-semibold tabular-nums ${isLow ? "text-red-500" : ""}`}
                        >
                          {item.currentInventory}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-muted-foreground tabular-nums">
                        {item.maxCapacity}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={qty === 0 ? "" : qty}
                          placeholder="0"
                          onChange={(e) =>
                            handleQtyChange(item.slot, e.target.value)
                          }
                          className={inputCls}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">
                  {orderedItems.length}
                </span>{" "}
                products
              </span>
              <span>
                <span className="font-semibold text-foreground">{totalQty}</span>{" "}
                units total
              </span>
            </div>
            <Button
              size="sm"
              disabled={totalQty === 0}
              onClick={handleSubmit}
              className="gap-1.5"
            >
              <ShoppingCartIcon className="size-3.5" />
              Generate DO
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function DODocument({
  order,
  onNewOrder,
}: {
  order: DeliveryOrder
  onNewOrder: () => void
}) {
  const dateObj = new Date(order.date)
  const formatted = dateObj.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const total = order.items.reduce((a, b) => a + b.qty, 0)

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
        <CheckCircleIcon className="size-4" />
        Delivery Order generated successfully
      </div>

      {/* DO Card */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* DO Header */}
        <div className="bg-primary px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-widest">
              Delivery Order
            </p>
            <p className="text-primary-foreground text-2xl font-bold font-mono tracking-wider mt-0.5">
              {order.code}
            </p>
          </div>
          <TruckIcon className="size-8 text-primary-foreground/40 mt-1" />
        </div>

        {/* DO Meta */}
        <div className="px-6 py-3 border-b grid grid-cols-2 gap-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Date:</span>
            <span className="font-medium">{formatted}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <HashIcon className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Machine:</span>
            <span className="font-medium font-mono">{order.machineId}</span>
          </div>
        </div>

        {/* DO Items */}
        <div className="px-6 py-3">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Slot", "Product Code", "Product Name", "Qty"].map((h, i) => (
                  <TableHead
                    key={i}
                    className={`text-[11px] font-semibold tracking-wide py-2 ${i === 3 ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.slot} className="h-9">
                  <TableCell className="py-1.5 font-mono font-bold tracking-wider">
                    {item.slot}
                  </TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">
                    {item.productCode}
                  </TableCell>
                  <TableCell className="py-1.5 font-medium">
                    {item.productName}
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-semibold tabular-nums">
                    {item.qty}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* DO Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {order.items.length} items
          </span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total units:</span>
            <span className="font-bold tabular-nums">{total}</span>
          </div>
        </div>

        {/* DO Code hint for driver */}
        <div className="mx-6 mb-4 mt-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
          <TruckIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Give this DO code to the driver:{" "}
            <span className="font-bold font-mono text-amber-900 dark:text-amber-200">
              {order.code}
            </span>
            . They will enter it in the Refill app to auto-fill their table.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <PrinterIcon className="size-3.5" />
          Print DO
        </Button>
        <Button size="sm" onClick={onNewOrder}>
          New Order
        </Button>
      </div>
    </div>
  )
}

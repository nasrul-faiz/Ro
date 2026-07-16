"use client"

import * as React from "react"
import Link from "next/link"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button, buttonVariants } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface HomeContentProps {
  initialRouteId?: string
}

export function HomeContent({ initialRouteId }: HomeContentProps) {
  const [machines, setMachines] = React.useState<Machine[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [assignments, setAssignments] = React.useState<RouteLocation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedRoute, setSelectedRoute] = React.useState<Machine | null>(null)
  const router = useRouter()
  const { isMobile, setOpen, setOpenMobile } = useSidebar()

  React.useEffect(() => {
    Promise.all([getMachines(), getProducts(), getRouteLocations()]).then(([machinesData, productsData, routeLocations]) => {
      setMachines(machinesData)
      setProducts(productsData)
      setAssignments(routeLocations)
      setLoading(false)
    })
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

  function handleSelectRoute(value: string | null) {
    const machine = machines.find((item) => item.value === value) ?? null
    setSelectedRoute(machine)

    if (isMobile) {
      setOpenMobile(false)
    } else {
      setOpen(false)
    }

    if (!value) {
      router.push("/home")
      return
    }

    router.push(`/home/${encodeURIComponent(value)}`)
  }

  const hasInvalidRoute = Boolean(initialRouteId) && !loading && !selectedRoute

  function handleRouteLinkClick() {
    if (isMobile) {
      setOpenMobile(false)
      return
    }

    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/home"
            onClick={handleRouteLinkClick}
            className={cn(
              buttonVariants({ variant: !selectedRoute ? "default" : "outline", size: "sm" })
            )}
          >
            All routes
          </Link>
          {machines.map((machine) => {
            const isActive = machine.value === selectedRoute?.value

            return (
              <Link
                key={machine.value}
                href={`/home/${encodeURIComponent(machine.value)}`}
                onClick={handleRouteLinkClick}
                className={cn(
                  buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" })
                )}
              >
                {machine.label}
              </Link>
            )
          })}
        </div>

        <Field className="w-full max-w-xl">
          <FieldLabel>Route</FieldLabel>
          <Select value={selectedRoute?.value ?? undefined} onValueChange={handleSelectRoute}>
            <SelectTrigger>
              <SelectValue placeholder="Select route" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
          {loading ? "Loading routes..." : "Select a route link above to view its assigned locations."}
        </div>
      )}
    </div>
  )
}

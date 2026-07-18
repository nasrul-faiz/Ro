"use client"

import * as React from "react"
import {
  MapPinIcon,
  SearchIcon,
  LocateIcon,
  RefreshCwIcon,
  ArrowUpDownIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
  CrosshairIcon,
} from "lucide-react"
import { getProducts, type Product } from "@/lib/product-store"
import { getStraightLineDistanceKm } from "@/lib/geo"
import { LoadingText } from "@/components/ui/loading-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SortMode = "code" | "distance"

interface LocationItem extends Product {
  latitude: number
  longitude: number
}

function buildDivIcon(L: typeof import("leaflet"), selected: boolean) {
  const size = selected ? 20 : 12
  return L.divIcon({
    className: "",
    html: `<span class="block rounded-full border-2 border-white shadow-md ${
      selected ? "bg-orange-500 ring-2 ring-orange-400/50" : "bg-sky-500"
    }" style="width:${size}px;height:${size}px;"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function buildUserIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: `<span class="relative flex" style="width:16px;height:16px;">
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60"></span>
      <span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white bg-blue-600 shadow-md"></span>
    </span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export function MapContent() {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<import("leaflet").Map | null>(null)
  const leafletRef = React.useRef<typeof import("leaflet") | null>(null)
  const markersRef = React.useRef<Map<string, import("leaflet").Marker>>(new Map())
  const userMarkerRef = React.useRef<import("leaflet").Marker | null>(null)

  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mapReady, setMapReady] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null)
  const [sortMode, setSortMode] = React.useState<SortMode>("code")
  const [expanded, setExpanded] = React.useState(false)
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = React.useState(false)
  const [geoError, setGeoError] = React.useState("")

  const loadProducts = React.useCallback(() => {
    setLoading(true)
    return getProducts().then((data) => {
      setProducts(data)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    let active = true
    loadProducts().then(() => {
      if (!active) return
    })
    return () => {
      active = false
    }
  }, [loadProducts])

  const locations = React.useMemo<LocationItem[]>(
    () =>
      products.filter(
        (product): product is LocationItem =>
          typeof product.latitude === "number" && typeof product.longitude === "number"
      ),
    [products]
  )

  const locationsWithDistance = React.useMemo(() => {
    return locations.map((location) => ({
      ...location,
      distanceKm: userLocation
        ? getStraightLineDistanceKm(userLocation.lat, userLocation.lng, location.latitude, location.longitude)
        : null,
    }))
  }, [locations, userLocation])

  const filteredLocations = React.useMemo(() => {
    const kw = searchQuery.trim().toLowerCase()
    let list = kw
      ? locationsWithDistance.filter(
          (item) =>
            item.productCode.toLowerCase().includes(kw) || item.productName.toLowerCase().includes(kw)
        )
      : locationsWithDistance

    list = [...list].sort((a, b) => {
      if (sortMode === "distance" && a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm
      }
      return a.productCode.localeCompare(b.productCode, undefined, { numeric: true, sensitivity: "base" })
    })

    return list
  }, [locationsWithDistance, searchQuery, sortMode])

  // Init map once
  React.useEffect(() => {
    if (loading || !containerRef.current || mapRef.current) return

    let cancelled = false

    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      leafletRef.current = L

      const defaultCenter: [number, number] =
        locations.length > 0 ? [locations[0].latitude, locations[0].longitude] : [3.139, 101.6869]

      const map = L.map(containerRef.current).setView(defaultCenter, 11)
      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map)

      setMapReady(true)
    })

    return () => {
      cancelled = true
      markersRef.current.clear()
      userMarkerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [loading, locations])

  // Sync markers whenever locations or selection changes
  React.useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || !mapReady) return

    const existingCodes = new Set(markersRef.current.keys())
    const nextCodes = new Set(locations.map((l) => l.productCode))

    // Remove stale markers
    existingCodes.forEach((code) => {
      if (!nextCodes.has(code)) {
        markersRef.current.get(code)?.remove()
        markersRef.current.delete(code)
      }
    })

    // Add or update markers
    locations.forEach((location) => {
      const isSelected = location.productCode === selectedCode
      const icon = buildDivIcon(L, isSelected)
      let marker = markersRef.current.get(location.productCode)

      if (!marker) {
        marker = L.marker([location.latitude, location.longitude], { icon })
          .addTo(map)
          .bindPopup(`<strong>${location.productCode}</strong><br/>${location.productName}`)
        marker.on("click", () => setSelectedCode(location.productCode))
        markersRef.current.set(location.productCode, marker)
      } else {
        marker.setIcon(icon)
        marker.setZIndexOffset(isSelected ? 1000 : 0)
      }
    })

    if (markersRef.current.size > 0 && !selectedCode) {
      const group = L.featureGroup(Array.from(markersRef.current.values()))
      map.fitBounds(group.getBounds().pad(0.2))
    }
  }, [locations, mapReady, selectedCode])

  // User location marker
  React.useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || !mapReady) return

    if (!userLocation) {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      return
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: buildUserIcon(L),
        zIndexOffset: 2000,
      })
        .addTo(map)
        .bindPopup("Your location")
    } else {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng])
    }
  }, [userLocation, mapReady])

  // Invalidate size when expanded/collapsed
  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const timer = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(timer)
  }, [expanded, mapReady])

  function focusLocation(location: LocationItem) {
    setSelectedCode(location.productCode)
    const map = mapRef.current
    const marker = markersRef.current.get(location.productCode)
    if (map && marker) {
      map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 })
      marker.openPopup()
    }
  }

  function handleResetView() {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || markersRef.current.size === 0) return
    setSelectedCode(null)
    const group = L.featureGroup(Array.from(markersRef.current.values()))
    map.fitBounds(group.getBounds().pad(0.2))
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported.")
      return
    }
    setGeoLoading(true)
    setGeoError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setGeoLoading(false)
        mapRef.current?.flyTo([loc.lat, loc.lng], 13, { duration: 0.6 })
      },
      () => {
        setGeoError("Could not get location.")
        setGeoLoading(false)
      }
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
        <LoadingText text="Loading map" />
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
        <MapPinIcon className="size-10 opacity-30" />
        <p className="text-sm">No location coordinates available yet.</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4",
        expanded ? "fixed inset-0 z-50 bg-background p-3" : "h-[calc(100vh-8rem)]"
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
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
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setSortMode((m) => (m === "code" ? "distance" : "code"))}
          disabled={!userLocation}
          title={userLocation ? "Toggle sort order" : "Locate yourself to sort by distance"}
        >
          <ArrowUpDownIcon className="size-3.5" />
          Sort: {sortMode === "code" ? "Code" : "Distance"}
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLocateMe} disabled={geoLoading}>
          <LocateIcon className="size-3.5" />
          {geoLoading ? "Locating…" : "Locate Me"}
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleResetView}>
          <CrosshairIcon className="size-3.5" />
          Reset View
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => loadProducts()}>
          <RefreshCwIcon className="size-3.5" />
          Refresh
        </Button>

        <Button
          variant="outline"
          size="icon-sm"
          className="ml-auto"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Exit fullscreen" : "Expand map"}
        >
          {expanded ? <Minimize2Icon className="size-3.5" /> : <Maximize2Icon className="size-3.5" />}
        </Button>
      </div>

      {geoError && <p className="text-xs text-red-500">{geoError}</p>}

      {/* Map */}
      <div
        ref={containerRef}
        className={cn(
          "isolate relative z-0 w-full overflow-hidden rounded-lg border",
          expanded ? "flex-1" : "h-[55%] min-h-[260px]"
        )}
      />

      {/* Location list */}
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Showing {filteredLocations.length} of {locations.length} location
            {locations.length === 1 ? "" : "s"}
          </p>
          {searchQuery && (
            <Button variant="ghost" size="icon-xs" onClick={() => setSearchQuery("")}>
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLocations.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No matching locations.</p>
          ) : (
            <ul className="divide-y">
              {filteredLocations.map((location) => {
                const isSelected = location.productCode === selectedCode
                return (
                  <li key={location.productCode}>
                    <button
                      type="button"
                      onClick={() => focusLocation(location)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60",
                        isSelected && "bg-orange-500/10"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full",
                          isSelected ? "bg-orange-500 text-white" : "bg-sky-500/15 text-sky-600"
                        )}
                      >
                        <MapPinIcon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{location.productCode}</span>
                        <span className="block truncate text-xs text-muted-foreground">{location.productName}</span>
                      </span>
                      {location.distanceKm != null && (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {location.distanceKm < 1
                            ? `${Math.round(location.distanceKm * 1000)} m`
                            : `${location.distanceKm.toFixed(1)} km`}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

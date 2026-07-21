"use client"

import * as React from "react"
import {
  MapPinIcon,
  SearchIcon,
  LocateIcon,
  ArrowUpDownIcon,
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

interface MapContentProps {
  refreshRef?: React.MutableRefObject<(() => void) | null>
}

export function MapContent({ refreshRef }: MapContentProps) {
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

  React.useEffect(() => {
    if (refreshRef) refreshRef.current = () => { loadProducts() }
  }, [loadProducts, refreshRef])

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
      try {
        const group = L.featureGroup(Array.from(markersRef.current.values()))
        map.fitBounds(group.getBounds().pad(0.2))
      } catch {
        // Ignore — map may have just been torn down.
      }
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

  // Invalidate map size once it's mounted and ready
  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const timer = setTimeout(() => {
      try {
        map.invalidateSize()
      } catch {
        // Ignore — map may have just been torn down.
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [mapReady])

  // Keep the map in sync with its container size — the container can resize
  // due to sidebar toggling, window resizing, etc. Without this, Leaflet's
  // internal position cache goes stale and later pan/zoom calls can throw
  // (e.g. "undefined is not an object (evaluating 'el._leaflet_pos')").
  React.useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container || !mapReady || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      if (mapRef.current !== map) return
      try {
        map.invalidateSize()
      } catch {
        // Ignore — map may have just been torn down.
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [mapReady])

  function focusLocation(location: LocationItem) {
    setSelectedCode(location.productCode)
    const map = mapRef.current
    const marker = markersRef.current.get(location.productCode)
    if (!map || !marker) return
    try {
      map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 })
      marker.openPopup()
    } catch {
      // Leaflet can throw if the map/marker position cache is momentarily
      // stale (e.g. right after a container resize); safe to ignore.
    }
  }

  function handleResetView() {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || markersRef.current.size === 0) return
    setSelectedCode(null)
    try {
      const group = L.featureGroup(Array.from(markersRef.current.values()))
      map.fitBounds(group.getBounds().pad(0.2))
    } catch {
      // Ignore stale position errors; the map remains usable.
    }
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
        try {
          mapRef.current?.flyTo([loc.lat, loc.lng], 13, { duration: 0.6 })
        } catch {
          // Ignore — map may have just been torn down.
        }
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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      {geoError && <p className="text-xs text-red-500">{geoError}</p>}

      {/* Map */}
      <div
        ref={containerRef}
        className="glass-card isolate relative z-0 w-full min-h-[260px] max-h-[55vh] flex-1 overflow-hidden rounded-2xl"
      />

      {/* Location list */}
      <div className="glass-card flex min-h-0 flex-none flex-col overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2.5">
          <div className="relative w-full max-w-[220px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location..."
              className="h-8 pl-8 pr-7 text-xs"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <XIcon className="size-3" />
              </Button>
            )}
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
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {filteredLocations.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No matching locations.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredLocations.map((location) => {
                const isSelected = location.productCode === selectedCode
                return (
                  <li key={location.productCode}>
                    <button
                      type="button"
                      onClick={() => focusLocation(location)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60",
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

        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Showing {filteredLocations.length} of {locations.length} location
            {locations.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleResetView}>
              <CrosshairIcon className="size-3.5" />
              Reset View
            </Button>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLocateMe} disabled={geoLoading}>
              <LocateIcon className="size-3.5" />
              {geoLoading ? "Locating…" : "Locate Me"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

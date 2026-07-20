"use client"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { MapContent } from "@/components/map-content"
import { Button } from "@/components/ui/button"

export default function MapPage() {
  const refreshRef = React.useRef<(() => void) | null>(null)

  return (
    <AppLayout
      title="Map"
      fullBleed
      defaultSidebarOpen={false}
      headerActions={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refreshRef.current?.()}>
          <RefreshCwIcon className="size-3.5" />
          Refresh
        </Button>
      }
    >
      <MapContent refreshRef={refreshRef} />
    </AppLayout>
  )
}

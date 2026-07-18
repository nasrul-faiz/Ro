"use client"

import * as React from "react"
import { AppLayout } from "@/components/app-layout"
import { EditMachineProductsContent } from "@/components/edit-machine-products-content"
import { EditPageToolbar } from "@/components/edit-page-toolbar"

export default function EditMachineProductsPage() {
  const saveRef = React.useRef<(() => Promise<void>) | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)

  return (
    <AppLayout title="Route Location">
      <div className="flex flex-col h-screen">
        <EditPageToolbar
          title="Route Location"
          onSave={() => saveRef.current?.() ?? Promise.resolve()}
          isDirty={isDirty}
        />
        <div className="flex-1 overflow-auto p-4">
          <EditMachineProductsContent onSaveRef={saveRef} onDirtyChange={setIsDirty} />
        </div>
      </div>
    </AppLayout>
  )
}

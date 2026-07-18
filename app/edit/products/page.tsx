"use client"

import * as React from "react"
import { AppLayout } from "@/components/app-layout"
import { EditProductsContent } from "@/components/edit-products-content"
import { EditPageToolbar } from "@/components/edit-page-toolbar"

export default function EditProductsPage() {
  const saveRef = React.useRef<(() => Promise<void>) | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)

  return (
    <AppLayout title="Location Master">
      <div className="flex flex-col h-screen">
        <EditPageToolbar
          title="Location Master"
          onSave={() => saveRef.current?.() ?? Promise.resolve()}
          isDirty={isDirty}
        />
        <div className="flex-1 overflow-auto p-4">
          <EditProductsContent onSaveRef={saveRef} onDirtyChange={setIsDirty} />
        </div>
      </div>
    </AppLayout>
  )
}

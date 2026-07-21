"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { EditProductsContent } from "@/components/edit-products-content"
import { EditSaveActions } from "@/components/edit-page-toolbar"

export default function EditProductsPage() {
  const router = useRouter()
  const saveRef = React.useRef<(() => Promise<void>) | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)

  return (
    <AppLayout
      title="Location Master"
      onBack={() => router.back()}
      fullBleed
      headerActions={
        <EditSaveActions
          onSave={() => saveRef.current?.() ?? Promise.resolve()}
          isDirty={isDirty}
        />
      }
    >
      <div className="h-full min-h-0 overflow-auto p-4">
        <EditProductsContent onSaveRef={saveRef} onDirtyChange={setIsDirty} />
      </div>
    </AppLayout>
  )
}

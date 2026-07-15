"use client"

import * as React from "react"
import { AppLayout } from "@/components/app-layout"
import { EditProductsContent } from "@/components/edit-products-content"
import { EditPageToolbar } from "@/components/edit-page-toolbar"

export default function EditProductsPage() {
  const saveRef = React.useRef<(() => Promise<void>) | null>(null)

  return (
    <AppLayout title="Location Master">
      <div className="flex flex-col h-screen">
        <EditPageToolbar
          title="Location Master"
          onSave={() => saveRef.current?.() ?? Promise.resolve()}
        />
        <div className="flex-1 overflow-auto p-4">
          <EditProductsContent onSaveRef={saveRef} />
        </div>
      </div>
    </AppLayout>
  )
}

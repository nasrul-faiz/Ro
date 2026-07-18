"use client"

import * as React from "react"
import { AppLayout } from "@/components/app-layout"
import { EditMachinesContent } from "@/components/edit-machines-content"
import { EditPageToolbar } from "@/components/edit-page-toolbar"

export default function EditMachinesPage() {
  const saveRef = React.useRef<(() => Promise<void>) | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)

  return (
    <AppLayout title="Manage Route">
      <div className="flex flex-col h-screen">
        <EditPageToolbar
          title="Route"
          onSave={() => saveRef.current?.() ?? Promise.resolve()}
          isDirty={isDirty}
        />
        <div className="flex-1 overflow-auto p-4">
          <EditMachinesContent onSaveRef={saveRef} onDirtyChange={setIsDirty} />
        </div>
      </div>
    </AppLayout>
  )
}

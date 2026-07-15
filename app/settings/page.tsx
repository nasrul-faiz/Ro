import { AppLayout } from "@/components/app-layout"
import { SettingsIcon } from "lucide-react"

export default function SettingsPage() {
  return (
    <AppLayout title="Settings">
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
        <SettingsIcon className="size-10 opacity-30" />
        <p className="text-sm">Settings coming soon.</p>
      </div>
    </AppLayout>
  )
}

import { AppLayout } from "@/components/app-layout"
import { MoonIcon, PaletteIcon, SettingsIcon } from "lucide-react"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SettingsPage() {
  return (
    <AppLayout title="Settings">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <PaletteIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Appearance</ItemTitle>
            <ItemDescription>
              Choose how the app looks on your device.
            </ItemDescription>
          </ItemContent>
          <ThemeToggle />
        </Item>
        <Item variant="muted">
          <ItemMedia variant="icon">
            <MoonIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Notifications</ItemTitle>
            <ItemDescription>
              Manage how you receive updates and alerts.
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item>
          <ItemMedia variant="icon">
            <SettingsIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>More settings coming soon</ItemTitle>
            <ItemDescription>
              Additional preferences will appear here.
            </ItemDescription>
          </ItemContent>
        </Item>
      </div>
    </AppLayout>
  )
}

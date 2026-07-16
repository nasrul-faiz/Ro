import { AppLayout } from "@/components/app-layout"
import { HomeContent } from "@/components/home-content"

export default function HomePage() {
  return (
    <AppLayout title="Route List" defaultSidebarOpen={false}>
      <HomeContent />
    </AppLayout>
  )
}

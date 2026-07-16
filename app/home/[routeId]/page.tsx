import { AppLayout } from "@/components/app-layout"
import { HomeContent } from "@/components/home-content"

interface HomeRoutePageProps {
  params: Promise<{
    routeId: string
  }>
}

export default async function HomeRoutePage({ params }: HomeRoutePageProps) {
  const { routeId } = await params

  return (
    <AppLayout title="Route List">
      <HomeContent initialRouteId={routeId} />
    </AppLayout>
  )
}
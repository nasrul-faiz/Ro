"use client"

import {
  HomeIcon,
  CalendarIcon,
  UsersIcon,
  SettingsIcon,
  MapIcon,
  ChevronsUpDownIcon,
  CheckIcon,
  RefreshCwIcon,
  PencilIcon,
  ServerIcon,
  LayoutGridIcon,
  PackageIcon,
  ArrowLeftIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const workspaces = [
  {
    id: "route-list",
    name: "Route List",
    description: "Browse routes and shifts",
    icon: LayoutGridIcon,
    initial: "R",
    color: "bg-sky-600",
    url: "/home",
  },
  {
    id: "edit",
    name: "Edit Mode",
    description: "Manage routes, locations, and route assignments",
    icon: PencilIcon,
    initial: "E",
    color: "bg-violet-600",
    url: "/edit",
  },
]

const defaultNavItems = [
  { title: "Home", icon: HomeIcon, url: "/home" },
  { title: "Map", icon: MapIcon, url: "/map" },
  { title: "Calendar", icon: CalendarIcon, url: "/calendar" },
  { title: "Team", icon: UsersIcon, url: "/team" },
]

const editNavItems = [
  { title: "Overview", icon: PencilIcon, url: "/edit" },
]

const settingsItems = [
  { title: "Settings", icon: SettingsIcon, url: "/settings" },
]

interface AppLayoutProps {
  title: string
  defaultSidebarOpen?: boolean
  headerActions?: React.ReactNode
  fullBleed?: boolean
  onBack?: () => void
  children: React.ReactNode
}

export function AppLayout({
  title,
  defaultSidebarOpen,
  headerActions,
  fullBleed,
  onBack,
  children,
}: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const activeWorkspace =
    workspaces.find((ws) => pathname.startsWith(ws.url)) ?? workspaces[0]
  const navItems = activeWorkspace.id === "edit" ? editNavItems : defaultNavItems
  const sidebarDefaultOpen = defaultSidebarOpen ?? activeWorkspace.id !== "edit"

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${activeWorkspace.color} text-white text-sm font-bold shrink-0`}
                    >
                      {activeWorkspace.initial}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-sm">
                        {activeWorkspace.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {activeWorkspace.description}
                      </span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width)"
                  align="start"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Apps
                  </DropdownMenuLabel>
                  {workspaces.map((ws) => {
                    const isActive = ws.id === activeWorkspace.id
                    return (
                      <DropdownMenuItem
                        key={ws.id}
                        className="gap-2"
                        onSelect={() => router.push(ws.url)}
                      >
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded ${ws.color} text-white text-xs font-bold shrink-0`}
                        >
                          {ws.initial}
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm">{ws.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {ws.description}
                          </span>
                        </div>
                        {isActive && (
                          <CheckIcon className="ml-auto size-4 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Switch between apps to manage routes and products.
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild closeOnClick>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            {settingsItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild closeOnClick>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <ThemeToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="glass-bar sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/40 px-4">
          {onBack ? (
            <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Go back">
              <ArrowLeftIcon />
            </Button>
          ) : (
            <SidebarTrigger />
          )}
          <h1 className="font-semibold">{title}</h1>
          {headerActions && (
            <div className="ml-auto flex items-center gap-2">{headerActions}</div>
          )}
        </header>
        <main className={cn("flex flex-1 flex-col", fullBleed ? "min-h-0 overflow-hidden" : "gap-4 p-6")}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

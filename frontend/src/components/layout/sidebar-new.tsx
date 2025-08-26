import { useState } from 'react'
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ChevronLeft,
  ChevronRight,
  Box,
  Cloud,
  Database,
  FileCode,
  GitBranch,
  HardDrive,
  Layers,
  Network,
  Package,
  Settings,
  Shield,
  Users,
  Server,
  Home,
  BarChart3,
  Activity,
  Terminal,
  FileText,
  Briefcase,
  Calendar,
} from "lucide-react"
import { useLocation, useNavigate } from 'react-router-dom'

const menuItems = [
  {
    title: "Overview",
    items: [
      { icon: Home, label: "Dashboard", href: "/" },
      { icon: BarChart3, label: "Metrics", href: "/metrics" },
      { icon: Activity, label: "Events", href: "/events" },
    ],
  },
  {
    title: "Workloads",
    items: [
      { icon: Box, label: "Pods", href: "/pods" },
      { icon: Layers, label: "Deployments", href: "/deployments" },
      { icon: Package, label: "StatefulSets", href: "/statefulsets" },
      { icon: GitBranch, label: "DaemonSets", href: "/daemonsets" },
    ],
  },
  {
    title: "Networking",
    items: [
      { icon: Network, label: "Services", href: "/services" },
      { icon: Cloud, label: "Ingresses", href: "/ingresses" },
    ],
  },
  {
    title: "Storage",
    items: [
      { icon: HardDrive, label: "PersistentVolumes", href: "/pv" },
      { icon: Database, label: "StorageClasses", href: "/storageclass" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { icon: FileCode, label: "ConfigMaps", href: "/configmaps" },
      { icon: Shield, label: "Secrets", href: "/secrets" },
    ],
  },
  {
    title: "Security",
    items: [
      { icon: Users, label: "ServiceAccounts", href: "/serviceaccounts" },
      { icon: Shield, label: "RBAC", href: "/rbac" },
    ],
  },
  {
    title: "Cluster",
    items: [
      { icon: Server, label: "Nodes", href: "/nodes" },
      { icon: FileText, label: "Namespaces", href: "/namespaces" },
    ],
  },
  {
    title: "Tools",
    items: [
      { icon: Terminal, label: "Terminal", href: "/terminal" },
      { icon: FileText, label: "Logs", href: "/logs" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Advanced",
    items: [
      { icon: Terminal, label: "Multi-Container Terminals", href: "/advanced/terminals" },
      { icon: FileText, label: "Manifest Viewer", href: "/advanced/manifests" },
      { icon: Network, label: "Deployment Topology", href: "/advanced/topology" },
      { icon: Server, label: "DaemonSet Topology", href: "/advanced/daemonset-topology" },
      { icon: Briefcase, label: "Job Topology", href: "/advanced/job-topology" },
      { icon: Calendar, label: "CronJob Topology", href: "/advanced/cronjob-topology" },
    ],
  },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCollapsed?: boolean
}

export function Sidebar({ className, defaultCollapsed = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div 
      className={cn(
        "relative h-full bg-background transition-all duration-300",
        collapsed ? "w-12 overflow-x-visible" : "w-64",
        className
      )}
    >
      <div className="absolute right-0 top-4 z-50 -mr-3">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 rounded-full border bg-background"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </div>

      <div className="h-full overflow-y-auto overflow-x-visible pb-12">
        <div className="space-y-4 py-4">
          {menuItems.map((section, idx) => (
            <div key={idx} className={cn("py-2", collapsed ? "px-1" : "px-3")}>
              {!collapsed && (
                <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                  {section.title}
                </h2>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Button
                      key={item.href}
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        collapsed && "justify-center px-2 py-2"
                      )}
                      onClick={() => navigate(item.href)}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", !collapsed && "mr-2")} />
                      {!collapsed && item.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import {
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
} from "lucide-react"

const menuItems = [
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
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  return (
    <div className={cn("pb-12 w-64", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Button variant="secondary" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              All Namespaces
            </Button>
          </div>
        </div>
        {menuItems.map((section) => (
          <div key={section.title} className="px-3 py-2">
            <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="w-full justify-start"
                  asChild
                >
                  <a href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Workflow,
  LogOut,
  User,
  Book,
} from "lucide-react"
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

interface MenuItem {
  icon: any;
  label: string;
  href: string;
}

interface MenuGroup {
  icon: any;
  label: string;
  items: MenuItem[];
}

interface MenuSection {
  title: string;
  items?: MenuItem[];
  groups?: MenuGroup[];
}

const menuItems: MenuSection[] = [
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
      { icon: Book, label: "API Documentation", href: "/advanced/api-docs" },
    ],
    groups: [
      {
        icon: Workflow,
        label: "Topology",
        items: [
          { icon: Network, label: "Deployment Topology", href: "/advanced/topology" },
          { icon: Server, label: "DaemonSet Topology", href: "/advanced/daemonset-topology" },
          { icon: Briefcase, label: "Job Topology", href: "/advanced/job-topology" },
          { icon: Calendar, label: "CronJob Topology", href: "/advanced/cronjob-topology" },
        ],
      },
    ],
  },
]

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCollapsed?: boolean
}

export function Sidebar({ className, defaultCollapsed = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Advanced-Topology': true, // Default expanded
  })
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  
  // Save scroll position continuously as user scrolls
  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollElement) return
    
    const saveScrollPosition = () => {
      sessionStorage.setItem('sidebar-scroll-position', scrollElement.scrollTop.toString())
    }
    
    scrollElement.addEventListener('scroll', saveScrollPosition)
    return () => scrollElement.removeEventListener('scroll', saveScrollPosition)
  }, [])
  
  // Store scroll position before navigation
  const handleNavigation = (href: string) => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        // Save to sessionStorage to persist across page loads
        sessionStorage.setItem('sidebar-scroll-position', scrollElement.scrollTop.toString())
      }
    }
    navigate(href)
  }
  
  // Restore scroll position immediately using useLayoutEffect to prevent visual blip
  useLayoutEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollElement) return
    
    const savedPosition = sessionStorage.getItem('sidebar-scroll-position')
    if (savedPosition) {
      setIsRestoring(true)
      scrollElement.scrollTop = parseFloat(savedPosition)
      // Small delay to allow scroll to settle before showing
      requestAnimationFrame(() => {
        setIsRestoring(false)
      })
    }
  }, [location.pathname])
  
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div 
      className={cn(
        "relative h-full bg-background transition-all duration-300",
        collapsed ? "w-12 overflow-x-visible" : "w-58",
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

      <ScrollArea 
        className={cn(
          "h-full transition-opacity duration-75",
          isRestoring && "opacity-95"
        )} 
        ref={scrollAreaRef}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-4 py-4">
          {menuItems.map((section, idx) => (
            <div key={idx} className={cn("py-2", collapsed ? "px-1" : "px-3")}>
              {!collapsed && (
                <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                  {section.title}
                </h2>
              )}
              <div className="space-y-1">
                {section.items?.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Button
                      key={item.href}
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        collapsed && "justify-center px-2 py-2"
                      )}
                      onClick={() => handleNavigation(item.href)}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        !collapsed && "mr-2",
                        // Add colors based on section
                        section.title === "Overview" && "text-blue-500 dark:text-blue-400",
                        section.title === "Workloads" && "text-violet-500 dark:text-violet-400",
                        section.title === "Networking" && "text-emerald-500 dark:text-emerald-400",
                        section.title === "Storage" && "text-orange-500 dark:text-orange-400",
                        section.title === "Configuration" && "text-purple-500 dark:text-purple-400",
                        section.title === "Security" && "text-red-500 dark:text-red-400",
                        section.title === "Cluster" && "text-cyan-500 dark:text-cyan-400",
                        section.title === "Tools" && "text-yellow-500 dark:text-yellow-400",
                        section.title === "Advanced" && "text-pink-500 dark:text-pink-400"
                      )} />
                      {!collapsed && item.label}
                    </Button>
                  )
                })}
                
                {/* Render collapsible groups */}
                {section.groups?.map((group) => {
                  const groupKey = `${section.title}-${group.label}`
                  const isExpanded = expandedGroups[groupKey]
                  const hasActiveItem = group.items.some(item => location.pathname === item.href)
                  
                  if (collapsed) {
                    // In collapsed mode, just show the group icon
                    return (
                      <div key={groupKey} className="space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-center px-2 py-2"
                          onClick={() => {
                            setCollapsed(false)
                            toggleGroup(groupKey)
                          }}
                          title={group.label}
                        >
                          <group.icon className={cn(
                            "h-4 w-4 flex-shrink-0",
                            // Advanced section gets pink color
                            "text-pink-500 dark:text-pink-400"
                          )} />
                        </Button>
                      </div>
                    )
                  }
                  
                  return (
                    <Collapsible
                      key={groupKey}
                      open={isExpanded}
                      onOpenChange={() => toggleGroup(groupKey)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant={hasActiveItem ? "secondary" : "ghost"}
                          className="w-full justify-start"
                        >
                          <group.icon className={cn(
                            "h-4 w-4 mr-2 flex-shrink-0",
                            // Advanced section gets pink color
                            "text-pink-500 dark:text-pink-400"
                          )} />
                          <span className="flex-1 text-left">{group.label}</span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="ml-4 space-y-1">
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.href
                          return (
                            <Button
                              key={item.href}
                              variant={isActive ? "secondary" : "ghost"}
                              className="w-full justify-start pl-2"
                              onClick={() => handleNavigation(item.href)}
                            >
                              <item.icon className={cn(
                                "h-3.5 w-3.5 mr-2 flex-shrink-0",
                                // Topology items get specific colors
                                item.label.includes("Deployment") && "text-blue-500 dark:text-blue-400",
                                item.label.includes("DaemonSet") && "text-green-500 dark:text-green-400",
                                item.label.includes("Job") && !item.label.includes("CronJob") && "text-orange-500 dark:text-orange-400",
                                item.label.includes("CronJob") && "text-purple-500 dark:text-purple-400"
                              )} />
                              <span className="text-sm">{item.label}</span>
                            </Button>
                          )
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* User section at bottom */}
        <div className={cn(
          "border-t mt-auto",
          collapsed ? "px-1 py-2" : "p-3"
        )}>
          {!collapsed ? (
            <div className="space-y-2">
              {user && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm">
                  <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-muted-foreground truncate flex-1">
                    {user.email}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2 text-red-500 dark:text-red-400" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full"
                  title={user.email}
                >
                  <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={handleLogout}
                title="Sign Out"
              >
                <LogOut className="h-4 w-4 text-red-500 dark:text-red-400" />
              </Button>
            </div>
          )}
        </div>
        </div>
      </ScrollArea>
    </div>
  )
}
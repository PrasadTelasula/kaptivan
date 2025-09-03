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
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
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
  Wifi,
} from "lucide-react"
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { ConnectionHealth } from '@/components/connection-health'
import { useConnectionHealth } from '@/hooks/use-connection-health'

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

interface CollapsedSidebarItemProps {
  item: MenuItem
  isActive: boolean
  onNavigate: (href: string) => void
  mouseY: any
  magnification: number
  distance: number
  springConfig: any
  sectionTitle: string
}

// Component for collapsed group icons with animation
function CollapsedGroupItem({
  group,
  groupKey,
  onGroupClick,
  mouseY,
  magnification,
  distance,
  springConfig
}: {
  group: MenuGroup
  groupKey: string
  onGroupClick: () => void
  mouseY: any
  magnification: number
  distance: number
  springConfig: any
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  
  const mouseDistance = useTransform(mouseY, (val) => {
    if (!itemRef.current) return distance + 1
    const rect = itemRef.current.getBoundingClientRect()
    return Math.abs(val - (rect.y + rect.height / 2))
  })
  
  const scale = useTransform(
    mouseDistance,
    [0, distance / 2, distance],
    [1.6, 1.3, 1.0] // Larger scale to create pop-out effect
  )
  
  const springScale = useSpring(scale, springConfig)
  
  return (
    <div key={groupKey} className="space-y-1">
      <motion.div
        ref={itemRef}
        style={{ scale: springScale }}
        className="flex justify-center relative z-50 overflow-visible"
      >
        <Button
          variant="ghost"
          className="justify-center w-8 h-8 p-0 rounded-full hover:rounded-full"
          onClick={onGroupClick}
          title={group.label}
        >
          <group.icon className="h-4 w-4 flex-shrink-0 text-pink-500 dark:text-pink-400" />
        </Button>
      </motion.div>
    </div>
  )
}

// Component for collapsed user section buttons with animation
function CollapsedUserButton({
  icon: Icon,
  title,
  iconClassName,
  onClick,
  mouseY,
  magnification,
  distance,
  springConfig
}: {
  icon: any
  title: string
  iconClassName: string
  onClick?: () => void
  mouseY: any
  magnification: number
  distance: number
  springConfig: any
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  
  const mouseDistance = useTransform(mouseY, (val) => {
    if (!itemRef.current) return distance + 1
    const rect = itemRef.current.getBoundingClientRect()
    return Math.abs(val - (rect.y + rect.height / 2))
  })
  
  const scale = useTransform(
    mouseDistance,
    [0, distance / 2, distance],
    [1.6, 1.3, 1.0] // Larger scale to create pop-out effect
  )
  
  const springScale = useSpring(scale, springConfig)
  
  return (
    <motion.div
      ref={itemRef}
      style={{ scale: springScale }}
      className="flex justify-center relative z-50 overflow-visible"
    >
      <Button
        variant="ghost"
        className="justify-center w-8 h-8 p-0 rounded-full hover:rounded-full"
        onClick={onClick}
        title={title}
      >
        <Icon className={cn("h-4 w-4", iconClassName)} />
      </Button>
    </motion.div>
  )
}

// Separate component to handle individual item animations
function CollapsedSidebarItem({ 
  item, 
  isActive, 
  onNavigate, 
  mouseY, 
  magnification, 
  distance, 
  springConfig,
  sectionTitle 
}: CollapsedSidebarItemProps) {
  const itemRef = useRef<HTMLDivElement>(null)
  
  // Calculate distance from mouse for each icon
  const mouseDistance = useTransform(mouseY, (val) => {
    if (!itemRef.current) return distance + 1
    const rect = itemRef.current.getBoundingClientRect()
    return Math.abs(val - (rect.y + rect.height / 2))
  })
  
  // Scale based on distance - allow popping outside sidebar
  const scale = useTransform(
    mouseDistance,
    [0, distance / 2, distance],
    [1.6, 1.3, 1.0] // Larger scale to create pop-out effect
  )
  
  const springScale = useSpring(scale, springConfig)
  
  return (
    <motion.div
      ref={itemRef}
      style={{ scale: springScale }}
      className="flex justify-center relative z-50 overflow-visible"
    >
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className="justify-center w-8 h-8 p-0 rounded-full hover:rounded-full"
        onClick={() => onNavigate(item.href)}
        title={item.label}
      >
        <item.icon className={cn(
          "h-4 w-4 flex-shrink-0",
          // Add colors based on section
          sectionTitle === "Overview" && "text-blue-500 dark:text-blue-400",
          sectionTitle === "Workloads" && "text-violet-500 dark:text-violet-400",
          sectionTitle === "Networking" && "text-emerald-500 dark:text-emerald-400",
          sectionTitle === "Storage" && "text-orange-500 dark:text-orange-400",
          sectionTitle === "Configuration" && "text-purple-500 dark:text-purple-400",
          sectionTitle === "Security" && "text-red-500 dark:text-red-400",
          sectionTitle === "Cluster" && "text-cyan-500 dark:text-cyan-400",
          sectionTitle === "Tools" && "text-yellow-500 dark:text-yellow-400",
          sectionTitle === "Advanced" && "text-pink-500 dark:text-pink-400"
        )} />
      </Button>
    </motion.div>
  )
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
      { icon: Wifi, label: "Connection Health Demo", href: "/demo/connection-health" },
    ],
  },
  {
    title: "Advanced",
    items: [
      { icon: Terminal, label: "Multi-Container Terminals", href: "/advanced/terminals" },
      { icon: FileText, label: "Manifest Viewer", href: "/advanced/manifests" },
      { icon: Book, label: "API Documentation", href: "/advanced/api-docs" },
      { icon: FileText, label: "Multi-Cluster Logs", href: "/advanced/logs" },
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
  const connectionHealth = useConnectionHealth()
  
  // Dock animation setup
  const mouseY = useMotionValue(Infinity)
  const springConfig = { mass: 0.1, stiffness: 200, damping: 15 }
  const magnification = 48 // Much smaller magnification to prevent overlap
  const distance = 80 // Reduced distance for tighter control
  
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
        collapsed ? "w-12 overflow-visible" : "w-58",
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
          isRestoring && "opacity-95",
          collapsed && "overflow-visible"
        )} 
        ref={scrollAreaRef}
        onMouseMove={(e) => {
          if (collapsed) {
            const rect = e.currentTarget.getBoundingClientRect()
            mouseY.set(e.clientY)
          }
        }}
        onMouseLeave={() => {
          if (collapsed) {
            mouseY.set(Infinity)
          }
        }}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-4 py-4">
          {menuItems.map((section, idx) => (
            <div key={idx} className={cn("py-2", collapsed ? "px-1 overflow-visible" : "px-3")}>
              {!collapsed && (
                <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                  {section.title}
                </h2>
              )}
              <div className="space-y-1">
                {section.items?.map((item, index) => {
                  const isActive = location.pathname === item.href
                  
                  return collapsed ? (
                    <CollapsedSidebarItem
                      key={item.href}
                      item={item}
                      isActive={isActive}
                      onNavigate={handleNavigation}
                      mouseY={mouseY}
                      magnification={magnification}
                      distance={distance}
                      springConfig={springConfig}
                      sectionTitle={section.title}
                    />
                  ) : (
                    <Button
                      key={item.href}
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleNavigation(item.href)}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 flex-shrink-0 mr-2",
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
                      {item.label}
                    </Button>
                  )
                })}
                
                {/* Render collapsible groups */}
                {section.groups?.map((group) => {
                  const groupKey = `${section.title}-${group.label}`
                  const isExpanded = expandedGroups[groupKey]
                  const hasActiveItem = group.items.some(item => location.pathname === item.href)
                  
                  if (collapsed) {
                    // In collapsed mode, show the group icon with dock animation
                    return (
                      <CollapsedGroupItem
                        key={groupKey}
                        group={group}
                        groupKey={groupKey}
                        onGroupClick={() => {
                          setCollapsed(false)
                          toggleGroup(groupKey)
                        }}
                        mouseY={mouseY}
                        magnification={magnification}
                        distance={distance}
                        springConfig={springConfig}
                      />
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
        
        {/* Connection Health section */}
        <div className={cn(
          "border-t",
          collapsed ? "px-1 py-2" : "px-3 py-2"
        )}>
          {!collapsed ? (
            <div className="space-y-1">
              <h2 className="px-2 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                Connection
              </h2>
              <ConnectionHealth
                isConnected={connectionHealth.isConnected}
                latency={connectionHealth.latency}
                messageCount={connectionHealth.messageCount}
                connectedAt={connectionHealth.connectedAt}
                compact={true}
              />
            </div>
          ) : null}
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
                <CollapsedUserButton
                  icon={User}
                  title={user.email}
                  iconClassName="text-slate-500 dark:text-slate-400"
                  mouseY={mouseY}
                  magnification={magnification}
                  distance={distance}
                  springConfig={springConfig}
                />
              )}
              <CollapsedUserButton
                icon={LogOut}
                title="Sign Out"
                iconClassName="text-red-500 dark:text-red-400"
                onClick={handleLogout}
                mouseY={mouseY}
                magnification={magnification}
                distance={distance}
                springConfig={springConfig}
              />
            </div>
          )}
        </div>
        </div>
      </ScrollArea>
    </div>
  )
}
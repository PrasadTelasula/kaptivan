import { useState, useEffect } from "react"
import { Eye, ChevronDown, ChevronRight, Box, Network, Server, Database, Shield, Activity, Briefcase, Calendar, FileCode, Key, HardDrive, Cloud, Lock, Users, Settings, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Namespace, ResourceCount } from "../types"
import { namespacesApi } from "../services/api"
import { cn } from "@/lib/utils"
import { NamespaceDetailsDialog } from "./NamespaceDetailsDialog"

interface NamespaceTableProps {
  namespaces: Namespace[]
}

export function NamespaceTable({ namespaces }: NamespaceTableProps) {
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleViewDetails = (namespace: Namespace) => {
    setSelectedNamespace(namespace)
    setDetailsOpen(true)
  }

  return (
    <>
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead>Cluster</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Resources</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {namespaces.map(namespace => (
            <NamespaceRow
              key={`${namespace.clusterId}-${namespace.name}`}
              namespace={namespace}
              onViewDetails={handleViewDetails}
            />
          ))}
        </TableBody>
      </Table>
    </div>
    <NamespaceDetailsDialog
      namespace={selectedNamespace}
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
    />
    </>
  )
}

interface NamespaceRowProps {
  namespace: Namespace
  onViewDetails: (namespace: Namespace) => void
}

function NamespaceRow({ namespace, onViewDetails }: NamespaceRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [resources, setResources] = useState<ResourceCount | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch resources immediately on mount to show in table view
  useEffect(() => {
    fetchResources()
  }, [namespace.clusterId, namespace.name])

  const fetchResources = async () => {
    setIsLoading(true)
    try {
      const data = await namespacesApi.getNamespaceResources(namespace.clusterId, namespace.name)
      if (data?.resources) {
        setResources(data.resources)
      }
    } catch (error) {
      console.error("Failed to fetch resources:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{namespace.name}</TableCell>
        <TableCell>{namespace.cluster}</TableCell>
        <TableCell>
          <Badge variant={
            namespace.status === "Active" ? "default" :
            namespace.status === "Terminating" ? "secondary" : "destructive"
          }>
            {namespace.status}
          </Badge>
        </TableCell>
        <TableCell>
          <ResourceBadges namespace={namespace} resources={resources} isLoading={isLoading} />
        </TableCell>
        <TableCell>{namespace.createdAt.toLocaleDateString()}</TableCell>
        <TableCell className="text-right">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => onViewDetails(namespace)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <Collapsible open={isExpanded}>
              <CollapsibleContent>
                <div className="px-8 py-4 bg-muted/20">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : resources ? (
                    <ResourceDetails resources={resources} />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No resource data available
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ResourceBadges({ namespace, resources, isLoading }: { namespace: Namespace; resources: ResourceCount | null; isLoading?: boolean }) {
  const totalResources = resources 
    ? Object.values(resources).reduce((sum, count) => sum + count, 0)
    : namespace.podCount + namespace.serviceCount

  // Show loading state with skeleton badges
  if (isLoading && !resources) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-12 bg-muted animate-pulse rounded" />
        <div className="h-6 w-12 bg-muted animate-pulse rounded" />
        <div className="h-6 w-12 bg-muted animate-pulse rounded" />
        <div className="h-6 w-16 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="gap-1">
            <Box className="h-3 w-3" />
            {resources?.pods ?? namespace.podCount}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{resources?.pods ?? namespace.podCount} Pods</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="gap-1">
            <Network className="h-3 w-3" />
            {resources?.services ?? namespace.serviceCount}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{resources?.services ?? namespace.serviceCount} Services</p>
        </TooltipContent>
      </Tooltip>
      {resources && (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1">
              <Server className="h-3 w-3" />
              {resources.deployments}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{resources.deployments} Deployments</p>
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="secondary" className="gap-1">
            <Layers className="h-3 w-3" />
            {totalResources}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{totalResources} Total Resources</p>
        </TooltipContent>
      </Tooltip>
      {namespace.resourceQuota && (
        <Tooltip>
          <TooltipTrigger>
            <Progress 
              value={(namespace.resourceQuota.cpu.used / namespace.resourceQuota.cpu.limit) * 100} 
              className="w-12 h-2"
            />
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p>CPU: {namespace.resourceQuota.cpu.used}/{namespace.resourceQuota.cpu.limit} cores</p>
              <p>Memory: {namespace.resourceQuota.memory.used}/{namespace.resourceQuota.memory.limit} Gi</p>
              <p>Storage: {namespace.resourceQuota.storage.used}/{namespace.resourceQuota.storage.limit} Gi</p>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function ResourceDetails({ resources }: { resources: ResourceCount }) {
  const resourceGroups = [
    {
      title: "Workloads",
      items: [
        { label: "Pods", value: resources.pods, icon: Box },
        { label: "Deployments", value: resources.deployments, icon: Server },
        { label: "StatefulSets", value: resources.statefulSets, icon: Database },
        { label: "DaemonSets", value: resources.daemonSets, icon: Shield },
        { label: "ReplicaSets", value: resources.replicaSets, icon: Activity },
        { label: "Jobs", value: resources.jobs, icon: Briefcase },
        { label: "CronJobs", value: resources.cronJobs, icon: Calendar },
      ]
    },
    {
      title: "Networking",
      items: [
        { label: "Services", value: resources.services, icon: Network },
        { label: "Ingresses", value: resources.ingresses, icon: Cloud },
        { label: "Network Policies", value: resources.networkPolicies, icon: Lock },
      ]
    },
    {
      title: "Config & Storage",
      items: [
        { label: "ConfigMaps", value: resources.configMaps, icon: FileCode },
        { label: "Secrets", value: resources.secrets, icon: Key },
        { label: "PVCs", value: resources.pvcs, icon: HardDrive },
      ]
    },
    {
      title: "Security",
      items: [
        { label: "Service Accounts", value: resources.serviceAccounts, icon: Users },
        { label: "Roles", value: resources.roles, icon: Shield },
        { label: "Role Bindings", value: resources.roleBindings, icon: Settings },
      ]
    },
  ]

  const totalResources = Object.values(resources).reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {resourceGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">{group.title}</h4>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t pt-3">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Total Resources</span>
          </div>
          <span className="text-lg font-bold tabular-nums">{totalResources}</span>
        </div>
      </div>
    </div>
  )
}

function LabelBadges({ labels }: { labels: Record<string, string> }) {
  const entries = Object.entries(labels)
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 2).map(([key, value]) => (
        <Badge key={key} variant="secondary" className="text-xs">
          {key}={value}
        </Badge>
      ))}
      {entries.length > 2 && (
        <Badge variant="secondary" className="text-xs">
          +{entries.length - 2}
        </Badge>
      )}
    </div>
  )
}
import { cn } from "@/lib/utils"
import { 
  Box, Network, Server, Database, Shield, Activity, 
  Briefcase, Calendar, FileCode, Key, HardDrive, Cloud, 
  Lock, Users, Layers, Settings
} from "lucide-react"

export interface ResourceCount {
  pods: number
  services: number
  deployments: number
  statefulSets: number
  daemonSets: number
  replicaSets: number
  jobs: number
  cronJobs: number
  configMaps: number
  secrets: number
  pvcs: number
  ingresses: number
  networkPolicies: number
  serviceAccounts: number
  roles: number
  roleBindings: number
}

interface ResourceStatsProps {
  resources: ResourceCount
  className?: string
  variant?: "compact" | "detailed" | "table"
}

interface ResourceItemProps {
  label: string
  value: number
  icon?: React.ReactNode
}

function ResourceItem({ label, value, icon }: ResourceItemProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

const resourceDefinitions = [
  { key: "pods", label: "Pods", icon: Box, category: "workload" },
  { key: "services", label: "Services", icon: Network, category: "networking" },
  { key: "deployments", label: "Deployments", icon: Server, category: "workload" },
  { key: "statefulSets", label: "StatefulSets", icon: Database, category: "workload" },
  { key: "daemonSets", label: "DaemonSets", icon: Shield, category: "workload" },
  { key: "replicaSets", label: "ReplicaSets", icon: Activity, category: "workload" },
  { key: "jobs", label: "Jobs", icon: Briefcase, category: "workload" },
  { key: "cronJobs", label: "CronJobs", icon: Calendar, category: "workload" },
  { key: "configMaps", label: "ConfigMaps", icon: FileCode, category: "config" },
  { key: "secrets", label: "Secrets", icon: Key, category: "config" },
  { key: "pvcs", label: "PVCs", icon: HardDrive, category: "storage" },
  { key: "ingresses", label: "Ingresses", icon: Cloud, category: "networking" },
  { key: "networkPolicies", label: "Network Policies", icon: Lock, category: "networking" },
  { key: "serviceAccounts", label: "Service Accounts", icon: Users, category: "security" },
  { key: "roles", label: "Roles", icon: Shield, category: "security" },
  { key: "roleBindings", label: "Role Bindings", icon: Settings, category: "security" },
]

export function ResourceStats({ resources, className, variant = "compact" }: ResourceStatsProps) {
  const totalResources = Object.values(resources).reduce((sum, count) => sum + count, 0)

  if (variant === "compact") {
    return (
      <div className={cn("grid grid-cols-2 gap-4", className)}>
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold tabular-nums">{resources.pods}</div>
          </div>
          <p className="text-xs text-muted-foreground ml-6">Pods</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold tabular-nums">{resources.services}</div>
          </div>
          <p className="text-xs text-muted-foreground ml-6">Services</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold tabular-nums">{resources.deployments}</div>
          </div>
          <p className="text-xs text-muted-foreground ml-6">Deployments</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold tabular-nums">{totalResources}</div>
          </div>
          <p className="text-xs text-muted-foreground ml-6">Total</p>
        </div>
      </div>
    )
  }

  if (variant === "table") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Resource Type</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {resourceDefinitions.map(({ key, label, icon: Icon }) => {
                const count = resources[key as keyof ResourceCount]
                return (
                  <tr key={key} className="border-b last:border-b-0 hover:bg-accent/50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                    </td>
                    <td className="text-right p-3">
                      <span className="text-sm font-semibold tabular-nums">{count}</span>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-muted/50">
                <td className="p-3 font-semibold">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Total Resources</span>
                  </div>
                </td>
                <td className="text-right p-3">
                  <span className="text-sm font-bold tabular-nums">{totalResources}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Resource Categories */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Workloads */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Workloads</h4>
          <div className="space-y-1">
            <ResourceItem 
              label="Pods" 
              value={resources.pods} 
              icon={<Box className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Deployments" 
              value={resources.deployments} 
              icon={<Server className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="StatefulSets" 
              value={resources.statefulSets} 
              icon={<Database className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="DaemonSets" 
              value={resources.daemonSets} 
              icon={<Shield className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="ReplicaSets" 
              value={resources.replicaSets} 
              icon={<Activity className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Jobs" 
              value={resources.jobs} 
              icon={<Briefcase className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="CronJobs" 
              value={resources.cronJobs} 
              icon={<Calendar className="h-3.5 w-3.5" />} 
            />
          </div>
        </div>

        {/* Networking */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Networking</h4>
          <div className="space-y-1">
            <ResourceItem 
              label="Services" 
              value={resources.services} 
              icon={<Network className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Ingresses" 
              value={resources.ingresses} 
              icon={<Cloud className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Network Policies" 
              value={resources.networkPolicies} 
              icon={<Lock className="h-3.5 w-3.5" />} 
            />
          </div>
        </div>

        {/* Config & Storage */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Config & Storage</h4>
          <div className="space-y-1">
            <ResourceItem 
              label="ConfigMaps" 
              value={resources.configMaps} 
              icon={<FileCode className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Secrets" 
              value={resources.secrets} 
              icon={<Key className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="PVCs" 
              value={resources.pvcs} 
              icon={<HardDrive className="h-3.5 w-3.5" />} 
            />
          </div>
        </div>

        {/* Security */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Security</h4>
          <div className="space-y-1">
            <ResourceItem 
              label="Service Accounts" 
              value={resources.serviceAccounts} 
              icon={<Users className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Roles" 
              value={resources.roles} 
              icon={<Shield className="h-3.5 w-3.5" />} 
            />
            <ResourceItem 
              label="Role Bindings" 
              value={resources.roleBindings} 
              icon={<Settings className="h-3.5 w-3.5" />} 
            />
          </div>
        </div>
      </div>

      {/* Total Summary */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Total Resources</span>
          </div>
          <span className="text-2xl font-bold tabular-nums">{totalResources}</span>
        </div>
      </div>
    </div>
  )
}
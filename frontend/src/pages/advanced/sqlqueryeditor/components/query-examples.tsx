import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, ChevronRight, Database, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface QueryExample {
  title: string
  description: string
  query: string
  category: string
}

const QUERY_EXAMPLES: QueryExample[] = [
  // Multi-cluster queries
  {
    title: 'Pods from Specific Cluster',
    description: 'Filter pods from a specific cluster (multi-cluster mode)',
    query: "SELECT name, namespace, phase FROM pods WHERE cluster = 'docker-desktop' AND phase = 'Running' LIMIT 10",
    category: 'Multi-Cluster'
  },
  {
    title: 'Compare Across Clusters',
    description: 'Get all pods from selected clusters (cluster column added automatically)',
    query: "SELECT name, namespace, phase FROM pods WHERE phase = 'Running' LIMIT 20",
    category: 'Multi-Cluster'
  },
  
  // Pods queries
  {
    title: 'Running Pods',
    description: 'Get all running pods with their basic info',
    query: "SELECT name, namespace, phase FROM pods WHERE phase = 'Running' LIMIT 10",
    category: 'Pods'
  },
  {
    title: 'Failed Pods',
    description: 'Find pods that have failed',
    query: "SELECT name, namespace, phase FROM pods WHERE phase = 'Failed'",
    category: 'Pods'
  },
  {
    title: 'Pod Resource Usage',
    description: 'Show pod resource requests and limits',
    query: "SELECT name, namespace, node, phase FROM pods WHERE node != ''",
    category: 'Pods'
  },
  {
    title: 'Pods by Node',
    description: 'List pods grouped by their nodes',
    query: "SELECT name, namespace, node FROM pods WHERE node != '' ORDER BY node",
    category: 'Pods'
  },
  
  // Deployments queries
  {
    title: 'Deployments Status',
    description: 'Check deployment readiness',
    query: "SELECT name, namespace, ready, desired FROM deployments",
    category: 'Deployments'
  },
  {
    title: 'Unhealthy Deployments',
    description: 'Find deployments with issues',
    query: "SELECT name, namespace, ready, desired FROM deployments WHERE ready < desired",
    category: 'Deployments'
  },
  
  // Services queries
  {
    title: 'Services by Type',
    description: 'List services grouped by type',
    query: "SELECT name, namespace, type FROM services WHERE type = 'LoadBalancer'",
    category: 'Services'
  },
  {
    title: 'All Services',
    description: 'List all services in the cluster',
    query: "SELECT name, namespace, type, cluster FROM services LIMIT 20",
    category: 'Services'
  },
  
  // Nodes queries
  {
    title: 'Nodes Capacity',
    description: 'Show node resource capacity',
    query: "SELECT name, cpu, memory FROM nodes",
    category: 'Nodes'
  },
  {
    title: 'Node Status',
    description: 'Check node health status',
    query: "SELECT name, status, version FROM nodes",
    category: 'Nodes'
  },
  
  // Namespaces queries
  {
    title: 'All Namespaces',
    description: 'List all namespaces in the cluster',
    query: "SELECT name, status, age FROM namespaces",
    category: 'Namespaces'
  },
  {
    title: 'Active Namespaces',
    description: 'Show only active namespaces',
    query: "SELECT name, status FROM namespaces WHERE status = 'Active'",
    category: 'Namespaces'
  },
  
  // StatefulSets queries
  {
    title: 'StatefulSets Status',
    description: 'Check StatefulSet replicas',
    query: "SELECT name, namespace, ready, replicas FROM statefulsets",
    category: 'StatefulSets'
  },
  {
    title: 'Unhealthy StatefulSets',
    description: 'Find StatefulSets with issues',
    query: "SELECT name, namespace, ready, replicas FROM statefulsets WHERE ready < replicas",
    category: 'StatefulSets'
  },
  
  // DaemonSets queries
  {
    title: 'DaemonSets Status',
    description: 'Check DaemonSet deployment',
    query: "SELECT name, namespace, ready, desired FROM daemonsets",
    category: 'DaemonSets'
  },
  {
    title: 'DaemonSets Coverage',
    description: 'Check DaemonSet node coverage',
    query: "SELECT name, namespace, ready, desired, current FROM daemonsets",
    category: 'DaemonSets'
  },
  
  // Jobs queries
  {
    title: 'Active Jobs',
    description: 'Show currently running jobs',
    query: "SELECT name, namespace, active, succeeded, failed FROM jobs WHERE active > 0",
    category: 'Jobs'
  },
  {
    title: 'Failed Jobs',
    description: 'Find jobs that have failed',
    query: "SELECT name, namespace, failed, completions FROM jobs WHERE failed > 0",
    category: 'Jobs'
  },
  
  // CronJobs queries
  {
    title: 'All CronJobs',
    description: 'List scheduled cron jobs',
    query: "SELECT name, namespace, schedule, suspend FROM cronjobs",
    category: 'CronJobs'
  },
  {
    title: 'Active CronJobs',
    description: 'Show non-suspended cron jobs',
    query: "SELECT name, namespace, schedule, active FROM cronjobs WHERE suspend != 'true'",
    category: 'CronJobs'
  },
  
  // ConfigMaps queries
  {
    title: 'ConfigMaps by Namespace',
    description: 'List ConfigMaps in specific namespace',
    query: "SELECT name, namespace FROM configmaps WHERE namespace = 'kube-system' LIMIT 5",
    category: 'ConfigMaps'
  },
  {
    title: 'All ConfigMaps',
    description: 'List all ConfigMaps',
    query: "SELECT name, namespace, age FROM configmaps LIMIT 20",
    category: 'ConfigMaps'
  },
  
  // Secrets queries
  {
    title: 'Secrets by Type',
    description: 'List secrets of specific type',
    query: "SELECT name, namespace, type FROM secrets WHERE type = 'kubernetes.io/service-account-token' LIMIT 10",
    category: 'Secrets'
  },
  {
    title: 'All Secrets',
    description: 'List all secrets (careful with this)',
    query: "SELECT name, namespace, type FROM secrets LIMIT 20",
    category: 'Secrets'
  },
  
  // Events queries
  {
    title: 'Recent Events',
    description: 'Show recent cluster events',
    query: "SELECT reason, message, object, count FROM events ORDER BY count DESC LIMIT 10",
    category: 'Events'
  },
  {
    title: 'Warning Events',
    description: 'Show warning type events',
    query: "SELECT reason, message, object, type FROM events WHERE type = 'Warning' LIMIT 20",
    category: 'Events'
  },
  {
    title: 'Failed Events',
    description: 'Find events with Failed reason',
    query: "SELECT reason, message, object, count FROM events WHERE reason ~= 'Failed' ORDER BY count DESC",
    category: 'Events'
  }
]

interface QueryExamplesProps {
  onSelectExample: (query: string) => void
}

export function QueryExamples({ onSelectExample }: QueryExamplesProps) {
  const [openCategories, setOpenCategories] = useState<string[]>(['Multi-Cluster', 'Pods'])
  const categories = Array.from(new Set(QUERY_EXAMPLES.map(example => example.category)))

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const getCategoryIcon = (category: string) => {
    if (category === 'Multi-Cluster') return <Server className="h-3 w-3" />
    return <Database className="h-3 w-3" />
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {categories.map((category, categoryIndex) => (
          <Collapsible 
            key={category} 
            open={openCategories.includes(category)}
            onOpenChange={() => toggleCategory(category)}
          >
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 px-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(category)}
                      <CardTitle className="text-sm">{category}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {QUERY_EXAMPLES.filter(e => e.category === category).length}
                      </Badge>
                    </div>
                    <ChevronRight 
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        openCategories.includes(category) && "rotate-90"
                      )}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="space-y-2">
                    {QUERY_EXAMPLES
                      .filter(example => example.category === category)
                      .map((example, index) => (
                        <div 
                          key={index} 
                          className={cn(
                            "p-3 rounded-lg border bg-card/50 hover:bg-accent/50 transition-all duration-200",
                            "animate-in fade-in-0 slide-in-from-left-2"
                          )}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="space-y-2">
                            <div>
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                {example.title}
                                {example.category === 'Multi-Cluster' && (
                                  <Badge variant="outline" className="text-xs">
                                    Multi
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {example.description}
                              </p>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="bg-muted/50 p-2.5 rounded-md text-sm font-mono hover:bg-muted transition-colors cursor-pointer">
                                  <code className="block whitespace-pre-wrap break-all">
                                    {example.query}
                                  </code>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-md">
                                <p className="font-mono text-sm whitespace-pre-wrap">{example.query}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                "w-full h-8 transition-all duration-200",
                                "hover:bg-primary hover:text-primary-foreground",
                                "group"
                              )}
                              onClick={() => onSelectExample(example.query)}
                            >
                              <Copy className="h-3 w-3 mr-1.5 transition-transform group-hover:scale-110" />
                              Use Query
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </TooltipProvider>
  )
}
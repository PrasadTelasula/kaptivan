import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, Cloud, Server, Box } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'

export function DashboardPage() {
  const [health, setHealth] = useState<{ status: string; service: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    clusters, 
    currentContext, 
    currentClusterVersion,
    fetchClusters 
  } = useClusterStore()
  
  const currentCluster = clusters.find(c => c.context === currentContext)

  useEffect(() => {
    fetch('http://localhost:8080/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => setError(err.message))

    fetchClusters()
  }, [fetchClusters])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar className="hidden lg:block border-r" />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
              <p className="text-muted-foreground">
                Multi-cluster Kubernetes management platform
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Backend Status
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {health ? (
                      <Badge variant="outline" className="bg-green-500/10">
                        {health.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Loading...</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {health?.service || 'Checking connection...'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Current Cluster
                  </CardTitle>
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currentCluster ? (
                      <span className="text-lg">{currentCluster.name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not connected</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentClusterVersion ? `v${currentClusterVersion.gitVersion}` : 'Select a cluster'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Nodes
                  </CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">
                    Active nodes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pods
                  </CardTitle>
                  <Box className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">
                    Running pods
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Getting Started</CardTitle>
                    <CardDescription>
                      Welcome to Kaptivan - Your multi-cluster Kubernetes dashboard
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        To get started, configure your kubeconfig file to connect to your Kubernetes clusters.
                      </p>
                      {error && (
                        <Badge variant="destructive" className="mt-2">
                          Error: {error}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="resources">
                <Card>
                  <CardHeader>
                    <CardTitle>Resources</CardTitle>
                    <CardDescription>
                      View and manage your Kubernetes resources
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No resources available. Connect a cluster to view resources.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="events">
                <Card>
                  <CardHeader>
                    <CardTitle>Events</CardTitle>
                    <CardDescription>
                      Recent cluster events and activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No events to display.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
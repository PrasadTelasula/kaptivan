import { useState, useEffect } from 'react'
import { ConnectionHealth } from '@/components/connection-health'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export default function ConnectionHealthDemo() {
  const [isConnected, setIsConnected] = useState(true)
  const [latency, setLatency] = useState<number | null>(45)
  const [messageCount, setMessageCount] = useState(1247)
  const [connectedAt] = useState(new Date(Date.now() - 39000)) // 39 seconds ago

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly update latency
      if (Math.random() > 0.7) {
        setLatency(prev => {
          if (prev === null) return Math.floor(Math.random() * 200) + 20
          return Math.floor(Math.random() * 100) + 20
        })
      }
      
      // Randomly increment messages
      if (Math.random() > 0.8) {
        setMessageCount(prev => prev + 1)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Connection Health Component Demo</h1>
        <p className="text-muted-foreground">
          A compact and space-efficient component for displaying connection status and metrics.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Adjust the component properties to see different states</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="connected" 
              checked={isConnected} 
              onCheckedChange={setIsConnected}
            />
            <Label htmlFor="connected">Connected</Label>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLatency(null)}
            >
              Set Latency N/A
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLatency(Math.floor(Math.random() * 200) + 20)}
            >
              Random Latency
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessageCount(prev => prev + Math.floor(Math.random() * 100))}
            >
              Add Messages
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Compact Mode (Sidebar-friendly) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Compact Mode 
            <Badge variant="secondary">Sidebar-friendly</Badge>
          </CardTitle>
          <CardDescription>
            Perfect for sidebars and tight spaces. Shows all metrics in a single line with tooltips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg bg-muted/20">
            <div className="text-sm text-muted-foreground mb-2">Sidebar Preview:</div>
            <ConnectionHealth
              isConnected={isConnected}
              latency={latency}
              messageCount={messageCount}
              connectedAt={connectedAt}
              compact={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Expanded Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Expanded Mode 
            <Badge variant="outline">Full details</Badge>
          </CardTitle>
          <CardDescription>
            Complete view with all metrics displayed in a grid layout with icons and descriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionHealth
            isConnected={isConnected}
            latency={latency}
            messageCount={messageCount}
            connectedAt={connectedAt}
            compact={false}
          />
        </CardContent>
      </Card>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
          <CardDescription>Different scenarios and configurations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Disconnected state */}
          <div>
            <h4 className="text-sm font-medium mb-2">Disconnected State</h4>
            <ConnectionHealth
              isConnected={false}
              latency={null}
              messageCount={0}
              connectedAt={new Date()}
              compact={true}
            />
          </div>

          {/* High message count */}
          <div>
            <h4 className="text-sm font-medium mb-2">High Message Volume</h4>
            <ConnectionHealth
              isConnected={true}
              latency={25}
              messageCount={156789}
              connectedAt={new Date(Date.now() - 3600000)} // 1 hour ago
              compact={true}
            />
          </div>

          {/* Long uptime */}
          <div>
            <h4 className="text-sm font-medium mb-2">Long Running Connection</h4>
            <ConnectionHealth
              isConnected={true}
              latency={78}
              messageCount={2456}
              connectedAt={new Date(Date.now() - 86400000 * 3)} // 3 days ago
              compact={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">✨ Compact Design</h4>
              <p className="text-muted-foreground">Single-line layout perfect for sidebars</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🎯 Tooltips</h4>
              <p className="text-muted-foreground">Hover for detailed information</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🎨 Status Colors</h4>
              <p className="text-muted-foreground">Visual indicators with smooth transitions</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">📊 Smart Formatting</h4>
              <p className="text-muted-foreground">Numbers auto-format (1.2k, 3.4m)</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">⏱️ Real-time</h4>
              <p className="text-muted-foreground">Live uptime calculation</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🌊 Animations</h4>
              <p className="text-muted-foreground">Subtle pulse and transition effects</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
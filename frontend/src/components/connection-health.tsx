import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  MessageSquare, 
  Activity,
  Calendar
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface ConnectionHealthProps {
  isConnected?: boolean
  latency?: number | null
  messageCount?: number
  uptime?: number
  connectedAt?: Date
  className?: string
  compact?: boolean
}

export function ConnectionHealth({
  isConnected = true,
  latency = null,
  messageCount = 0,
  uptime = 0,
  connectedAt = new Date(),
  className,
  compact = false
}: ConnectionHealthProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second for real-time uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Format numbers with k/m suffix
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}m`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  // Format uptime duration
  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
  }

  // Format latency
  const formatLatency = (ms: number | null): string => {
    if (ms === null) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  // Calculate real uptime based on connectedAt
  const realUptime = connectedAt ? Math.floor((currentTime.getTime() - connectedAt.getTime()) / 1000) : uptime

  const statusColor = isConnected ? 'text-green-500' : 'text-red-500'
  const statusBgColor = isConnected ? 'bg-green-500/10' : 'bg-red-500/10'

  if (compact) {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-1.5", className)}>
          {/* Status indicator with pulse animation */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <div className={cn(
                  "h-2 w-2 rounded-full transition-all duration-300",
                  isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                )} />
                {isConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isConnected ? 'Connected' : 'Disconnected'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Metrics in a single line */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {/* Latency */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5">
                  <Activity className="h-3 w-3" />
                  <span className={cn(latency === null && "text-orange-500")}>
                    {formatLatency(latency)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Latency</p>
              </TooltipContent>
            </Tooltip>

            <span className="text-muted-foreground/50">•</span>

            {/* Messages */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5">
                  <MessageSquare className="h-3 w-3" />
                  <span>{formatNumber(messageCount)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Messages</p>
              </TooltipContent>
            </Tooltip>

            <span className="text-muted-foreground/50">•</span>

            {/* Uptime */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  <span>{formatUptime(realUptime)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Uptime</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-2 p-3 rounded-lg border bg-card", className)}>
        {/* Header with status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full transition-all duration-300",
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            <span className={cn("text-sm font-medium transition-colors", statusColor)}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {isConnected ? (
            <Wifi className={cn("h-4 w-4", statusColor)} />
          ) : (
            <WifiOff className={cn("h-4 w-4", statusColor)} />
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                <Activity className="h-3 w-3 text-blue-500" />
                <div>
                  <div className="text-muted-foreground">Latency</div>
                  <div className={cn("font-mono font-medium", latency === null && "text-orange-500")}>
                    {formatLatency(latency)}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Network latency</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                <MessageSquare className="h-3 w-3 text-emerald-500" />
                <div>
                  <div className="text-muted-foreground">Messages</div>
                  <div className="font-mono font-medium">{formatNumber(messageCount)}</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Total messages received</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                <Clock className="h-3 w-3 text-purple-500" />
                <div>
                  <div className="text-muted-foreground">Uptime</div>
                  <div className="font-mono font-medium">{formatUptime(realUptime)}</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Connection uptime</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                <Calendar className="h-3 w-3 text-cyan-500" />
                <div>
                  <div className="text-muted-foreground">Connected</div>
                  <div className="font-mono font-medium text-[10px]">
                    {connectedAt.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Connection timestamp</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Status badge */}
        <div className="flex justify-center">
          <Badge 
            variant={isConnected ? "secondary" : "destructive"}
            className={cn(
              "text-xs transition-all duration-300",
              isConnected && statusBgColor
            )}
          >
            {isConnected ? 'Online' : 'Offline'}
          </Badge>
        </div>
      </div>
    </TooltipProvider>
  )
}
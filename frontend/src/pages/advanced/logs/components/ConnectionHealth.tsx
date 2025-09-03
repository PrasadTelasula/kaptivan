import React from 'react'
import { Wifi, WifiOff, AlertTriangle, Activity, MessageSquare, Clock, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ConnectionHealth as ConnectionHealthType } from '../types/logs'
import { cn } from '@/utils/cn'

interface ConnectionHealthProps {
  health: ConnectionHealthType
  className?: string
  compact?: boolean
}

const ConnectionHealth: React.FC<ConnectionHealthProps> = ({ health, className, compact = true }) => {
  const formatUptime = (uptime: number) => {
    if (uptime === 0) return '0s'
    
    const seconds = Math.floor(uptime / 1000) % 60
    const minutes = Math.floor(uptime / (1000 * 60)) % 60
    const hours = Math.floor(uptime / (1000 * 60 * 60))
    
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }
  
  const formatLatency = (latency: number | null) => {
    if (latency === null) return 'N/A'
    return `${latency}ms`
  }
  
  const formatTime = (date: Date | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }
  
  const getStatusIcon = () => {
    switch (health.status) {
      case 'connected':
        return <Wifi className="w-3 h-3 text-green-500" />
      case 'disconnected':
        return <WifiOff className="w-3 h-3 text-red-500" />
      case 'reconnecting':
        return <RefreshCcw className="w-3 h-3 text-yellow-500 animate-spin" />
      case 'error':
        return <AlertTriangle className="w-3 h-3 text-red-500" />
      default:
        return <WifiOff className="w-3 h-3 text-gray-500" />
    }
  }
  
  const getStatusText = () => {
    switch (health.status) {
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      case 'reconnecting':
        return `Reconnecting... (${health.metrics.reconnectAttempts})`
      case 'error':
        return 'Error'
      default:
        return 'Unknown'
    }
  }

  // Single line compact view
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 text-xs text-muted-foreground",
        className
      )}>
        {/* Status */}
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </div>
        
        {/* Separator */}
        <span className="text-muted-foreground/30">•</span>
        
        {/* Latency */}
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>{formatLatency(health.metrics.latency)}</span>
        </div>
        
        {/* Separator */}
        <span className="text-muted-foreground/30">•</span>
        
        {/* Messages */}
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          <span>{health.metrics.messagesReceived || 0}</span>
        </div>
        
        {/* Separator */}
        <span className="text-muted-foreground/30">•</span>
        
        {/* Uptime */}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatUptime(health.metrics.uptime)}</span>
        </div>
        
        {/* Warning indicator if there are warnings */}
        {health.warnings && health.warnings.length > 0 && (
          <>
            <span className="text-muted-foreground/30">•</span>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              <span className="text-yellow-500">{health.warnings[0]}</span>
            </div>
          </>
        )}
        
        {/* Connected time */}
        {health.status === 'connected' && health.lastConnectedAt && (
          <>
            <span className="text-muted-foreground/30 ml-auto">•</span>
            <span className="text-xs">Since {formatTime(health.lastConnectedAt)}</span>
          </>
        )}
      </div>
    )
  }
  
  // Full card view (if needed later)
  return (
    <div className={cn("p-4 border rounded-lg", className)}>
      {/* Implementation for full view if needed */}
    </div>
  )
}

// Connection Health Indicator component
export default ConnectionHealth
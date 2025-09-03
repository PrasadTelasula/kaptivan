export interface LogEntry {
  timestamp: Date
  message: string
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE'
  cluster: string
  namespace: string
  pod: string
  container: string
  source: 'stdout' | 'stderr'
  lineNumber: number
  highlighted?: boolean
}

export interface LogQuery {
  clusters: string[]
  namespaces: string[]
  pods: string[]
  containers: string[]
  startTime?: Date
  endTime?: Date
  searchTerm?: string
  logLevels: string[]
  limit?: number
  tail?: number
  follow?: boolean
}

export interface LogResponse {
  logs: LogEntry[]
  totalCount: number
  hasMore: boolean
  clusters: string[]
  query: LogQuery
}

export interface LogHistogram {
  timestamp: Date
  count: number
  levels: Record<string, number>
}

export interface LogStats {
  totalLogs: number
  logsPerLevel: Record<string, number>
  logsPerPod: Record<string, number>
  errorRate: number
  histogram: LogHistogram[]
}

export interface StreamMessage {
  type: 'logs' | 'error' | 'stats' | 'ping'
  data: any
  eventId: string
}

export interface LogFilters {
  clusters: string[]
  namespaces: string[]
  pods: string[]
  containers: string[]
  logLevels: string[]
  searchTerm: string
  timeRange: {
    start?: Date
    end?: Date
    preset?: 'last5m' | 'last15m' | 'last1h' | 'last6h' | 'last24h' | 'custom'
  }
  autoRefresh: boolean
  refreshInterval: number
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface ConnectionMetrics {
  latency: number | null
  lastPingTime: Date | null
  lastPongTime: Date | null
  messagesSent: number
  messagesReceived: number
  messagesDropped: number
  reconnectAttempts: number
  uptime: number // in milliseconds
}

export interface ConnectionHealth {
  status: ConnectionStatus
  metrics: ConnectionMetrics
  isHealthy: boolean
  warnings: string[]
  error?: string
  lastConnectedAt?: Date
  lastDisconnectedAt?: Date
}

export interface PingMessage {
  type: 'ping'
  timestamp: number
  id: string
}

export interface PongMessage {
  type: 'pong'
  timestamp: number
  id: string
}
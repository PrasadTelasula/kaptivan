import type { LogQuery, StreamMessage, ConnectionHealth, ConnectionMetrics, PingMessage, PongMessage } from '../types/logs'

export class LogWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pingInterval: NodeJS.Timeout | null = null
  private pingId = 0
  private pendingPings = new Map<string, number>()
  private connectionStartTime = 0
  private lastActivityTime = 0
  
  private health: ConnectionHealth = {
    status: 'disconnected',
    metrics: {
      latency: null,
      lastPingTime: null,
      lastPongTime: null,
      messagesSent: 0,
      messagesReceived: 0,
      messagesDropped: 0,
      reconnectAttempts: 0,
      uptime: 0
    },
    isHealthy: false,
    warnings: []
  }
  
  constructor(
    private onMessage: (message: StreamMessage) => void,
    private onError?: (error: Error) => void,
    private onConnect?: () => void,
    private onDisconnect?: () => void,
    private onHealthChange?: (health: ConnectionHealth) => void
  ) {}
  
  connect(query: LogQuery) {
    const wsUrl = `ws://localhost:8080/api/v1/logs/stream`
    
    try {
      this.updateHealthStatus('reconnecting')
      this.ws = new WebSocket(wsUrl)
      this.connectionStartTime = Date.now()
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.health.metrics.reconnectAttempts = 0
        this.health.lastConnectedAt = new Date()
        this.updateHealthStatus('connected')
        this.startPingInterval()
        this.onConnect?.()
        
        // Send initial query
        this.sendQuery(query)
      }
      
      this.ws.onmessage = (event) => {
        this.lastActivityTime = Date.now()
        this.health.metrics.messagesReceived++
        
        try {
          const message: StreamMessage | PongMessage = JSON.parse(event.data)
          
          // Handle pong messages for latency calculation
          if (message.type === 'pong') {
            this.handlePong(message as PongMessage)
          } else {
            this.onMessage(message as StreamMessage)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
          this.health.metrics.messagesDropped++
          this.updateHealth()
        }
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.updateHealthStatus('error', 'WebSocket connection error')
        this.onError?.(new Error('WebSocket error'))
      }
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.health.lastDisconnectedAt = new Date()
        this.stopPingInterval()
        this.updateHealthStatus('disconnected')
        this.onDisconnect?.()
        this.attemptReconnect(query)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      this.updateHealthStatus('error', `Failed to create WebSocket: ${error}`)
      this.onError?.(error as Error)
    }
  }
  
  private attemptReconnect(query: LogQuery) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      this.health.metrics.reconnectAttempts = this.reconnectAttempts
      this.updateHealthStatus('reconnecting')
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      setTimeout(() => {
        this.connect(query)
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      this.updateHealthStatus('error', 'Maximum reconnect attempts reached')
    }
  }
  
  sendQuery(query: LogQuery) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(query))
      this.health.metrics.messagesSent++
      this.updateHealth()
    }
  }
  
  disconnect() {
    this.stopPingInterval()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.updateHealthStatus('disconnected')
  }
  
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
  
  getHealth(): ConnectionHealth {
    return { ...this.health }
  }
  
  private startPingInterval() {
    this.stopPingInterval()
    this.pingInterval = setInterval(() => {
      this.sendPing()
    }, 30000) // Ping every 30 seconds
  }
  
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
  
  private sendPing() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const pingMessage: PingMessage = {
        type: 'ping',
        timestamp: Date.now(),
        id: `ping-${++this.pingId}`
      }
      
      this.pendingPings.set(pingMessage.id, pingMessage.timestamp)
      this.ws.send(JSON.stringify(pingMessage))
      this.health.metrics.lastPingTime = new Date()
      this.health.metrics.messagesSent++
      
      // Clean up old pending pings (older than 1 minute)
      const cutoff = Date.now() - 60000
      for (const [id, timestamp] of this.pendingPings.entries()) {
        if (timestamp < cutoff) {
          this.pendingPings.delete(id)
        }
      }
      
      this.updateHealth()
    }
  }
  
  private handlePong(pong: PongMessage) {
    const pingTime = this.pendingPings.get(pong.id)
    if (pingTime) {
      const latency = pong.timestamp - pingTime
      this.health.metrics.latency = latency
      this.health.metrics.lastPongTime = new Date()
      this.pendingPings.delete(pong.id)
      this.updateHealth()
    }
  }
  
  private updateHealthStatus(status: ConnectionHealth['status'], error?: string) {
    this.health.status = status
    this.health.error = error
    this.updateHealth()
  }
  
  private updateHealth() {
    // Update uptime
    if (this.connectionStartTime > 0) {
      this.health.metrics.uptime = Date.now() - this.connectionStartTime
    }
    
    // Determine if connection is healthy
    const isConnected = this.health.status === 'connected'
    const hasRecentActivity = this.lastActivityTime > 0 && (Date.now() - this.lastActivityTime) < 60000 // Last activity within 1 minute
    const hasGoodLatency = this.health.metrics.latency === null || this.health.metrics.latency < 5000 // Less than 5 seconds
    const hasLowDropRate = this.health.metrics.messagesReceived === 0 || 
                          (this.health.metrics.messagesDropped / this.health.metrics.messagesReceived) < 0.1 // Less than 10% drop rate
    
    this.health.isHealthy = isConnected && hasGoodLatency && hasLowDropRate
    
    // Generate warnings
    this.health.warnings = []
    
    if (this.health.metrics.latency && this.health.metrics.latency > 3000) {
      this.health.warnings.push(`High latency: ${this.health.metrics.latency}ms`)
    }
    
    if (this.health.metrics.messagesDropped > 0) {
      const dropRate = (this.health.metrics.messagesDropped / this.health.metrics.messagesReceived) * 100
      if (dropRate > 5) {
        this.health.warnings.push(`Message drop rate: ${dropRate.toFixed(1)}%`)
      }
    }
    
    if (this.health.metrics.reconnectAttempts > 0) {
      this.health.warnings.push(`Reconnected ${this.health.metrics.reconnectAttempts} times`)
    }
    
    if (!hasRecentActivity && isConnected) {
      this.health.warnings.push('No recent activity')
    }
    
    // Notify health change
    this.onHealthChange?.({ ...this.health })
  }
}
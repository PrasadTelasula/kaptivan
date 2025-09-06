import { useEffect, useRef, useCallback, useState } from 'react'

export interface EventUpdate {
  type: 'ADDED' | 'MODIFIED' | 'DELETED'
  event: {
    name: string
    namespace: string
    type: string
    reason: string
    message: string
    count: number
    firstTimestamp: string
    lastTimestamp: string
    involvedObjectKind: string
    involvedObjectName: string
    source: string
    sourceComponent: string
    sourceHost: string
    age: string
  }
  cluster: string
  timestamp: string
}

export interface EventSubscription {
  clusters: string[]
  namespaces: string[]
  types: string[]
  reasons: string[]
}

interface UseEventWebSocketOptions {
  onEventUpdate?: (update: EventUpdate) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useEventWebSocket(options: UseEventWebSocketOptions = {}) {
  const {
    onEventUpdate,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 5000
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const subscriptionRef = useRef<EventSubscription | null>(null)
  const shouldReconnectRef = useRef(autoReconnect)
  const isMountedRef = useRef(true)

  const connect = () => {
    // Check if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return
    }

    shouldReconnectRef.current = autoReconnect
    setIsConnecting(true)
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//localhost:8080/api/v1/events/ws`)
      
      ws.onopen = () => {
        // WebSocket connected
        setIsConnected(true)
        setIsConnecting(false)
        onConnect?.()
        
        // Resend subscription if we had one before reconnecting
        if (subscriptionRef.current) {
          ws.send(JSON.stringify(subscriptionRef.current))
        }
      }
      
      ws.onmessage = (event) => {
        try {
          const update: EventUpdate = JSON.parse(event.data)
          onEventUpdate?.(update)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
          onError?.(error as Error)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(new Error('WebSocket connection error'))
      }
      
      ws.onclose = () => {
        // WebSocket disconnected
        setIsConnected(false)
        setIsConnecting(false)
        onDisconnect?.()
        wsRef.current = null
        
        // Auto-reconnect if enabled and not manually disconnected
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            // Attempting to reconnect
            connect()
          }, reconnectInterval)
        }
      }
      
      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setIsConnecting(false)
      onError?.(error as Error)
    }
  }

  const disconnect = () => {
    // Disable auto-reconnect
    shouldReconnectRef.current = false
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    
    // Close WebSocket if exists
    if (wsRef.current) {
      // Temporarily disable event handlers to prevent reconnection
      const ws = wsRef.current
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
    setIsConnecting(false)
  }

  const subscribe = (subscription: EventSubscription) => {
    subscriptionRef.current = subscription
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(subscription))
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      disconnect()
    }
  }, [])

  return {
    connect,
    disconnect,
    subscribe,
    isConnected,
    isConnecting
  }
}
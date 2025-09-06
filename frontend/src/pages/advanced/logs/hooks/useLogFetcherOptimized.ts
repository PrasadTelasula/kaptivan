import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { LogEntry, LogQuery, LogFilters } from '../types/logs'
import { LogService } from '../services/logService'
import { LogWebSocket } from '../services/logWebSocket'
import { useConnectionHealth } from './useConnectionHealth'
import { useLogBuffer } from '@/hooks/useCircularBuffer'

const MAX_LOGS = 10000 // Maximum logs to keep in memory

export const useLogFetcherOptimized = (filters: LogFilters) => {
  // Use circular buffer instead of regular array
  const logBuffer = useLogBuffer(MAX_LOGS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [totalLogsReceived, setTotalLogsReceived] = useState(0)
  
  const wsRef = useRef<LogWebSocket | null>(null)
  const isStreamingRef = useRef(false)
  const { health, updateHealth, resetHealth } = useConnectionHealth()
  
  // Performance metrics
  const metricsRef = useRef({
    logsReceived: 0,
    logsDropped: 0,
    lastUpdateTime: Date.now(),
    updateCount: 0
  })
  
  // Get logs as array for display (memoized for performance)
  const logs = useMemo(() => {
    return logBuffer.getAll()
  }, [logBuffer, totalLogsReceived]) // Re-compute when logs change
  
  // Build query from filters
  const buildQuery = useCallback((): LogQuery => {
    const query: LogQuery = {
      clusters: filters.clusters,
      namespaces: filters.namespaces,
      pods: filters.pods,
      containers: filters.containers || [],
      logLevels: filters.logLevels,
      searchTerm: filters.searchTerm,
      limit: 1000,
      tail: 100,
      follow: isStreaming
    }
    
    // Handle time range
    if (filters.timeRange.preset) {
      const now = new Date()
      switch (filters.timeRange.preset) {
        case 'last5m':
          query.startTime = new Date(now.getTime() - 5 * 60 * 1000)
          break
        case 'last15m':
          query.startTime = new Date(now.getTime() - 15 * 60 * 1000)
          break
        case 'last1h':
          query.startTime = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case 'last6h':
          query.startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
          break
        case 'last24h':
          query.startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
      }
      query.endTime = now
    } else if (filters.timeRange.start && filters.timeRange.end) {
      query.startTime = filters.timeRange.start
      query.endTime = filters.timeRange.end
    }
    
    return query
  }, [filters, isStreaming])
  
  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (filters.clusters.length === 0 || filters.namespaces.length === 0 || 
        filters.pods.length === 0 || filters.containers.length === 0) {
      logBuffer.clear()
      setTotalLogsReceived(0)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const query = buildQuery()
      const response = await LogService.fetchLogs(query)
      
      // Clear buffer and add new logs
      logBuffer.clear()
      logBuffer.pushBatch(response.logs)
      setTotalLogsReceived(response.logs.length)
      
      // Update metrics
      metricsRef.current.logsReceived = response.logs.length
      metricsRef.current.lastUpdateTime = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      logBuffer.clear()
      setTotalLogsReceived(0)
    } finally {
      setLoading(false)
    }
  }, [filters, buildQuery, logBuffer])
  
  // Start streaming with optimized buffer management
  const startStreaming = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.disconnect()
    }
    
    resetHealth()
    
    // First, fetch initial logs based on time range
    setLoading(true)
    try {
      const query = buildQuery()
      const response = await LogService.fetchLogs(query)
      
      // Initialize buffer with initial logs
      logBuffer.clear()
      logBuffer.pushBatch(response.logs)
      setTotalLogsReceived(response.logs.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch initial logs')
      logBuffer.clear()
      setTotalLogsReceived(0)
      setLoading(false)
      return
    }
    setLoading(false)
    
    // Then start WebSocket for new logs
    const ws = new LogWebSocket(
      (message) => {
        // Only process messages if this is still the active WebSocket connection
        if (wsRef.current !== ws || !isStreamingRef.current) {
          console.log('Ignoring message from inactive WebSocket connection')
          return
        }
        
        if (message.type === 'logs' && Array.isArray(message.data)) {
          // Use efficient batch push to circular buffer
          logBuffer.pushBatch(message.data)
          
          // Update total count
          setTotalLogsReceived(prev => {
            const newTotal = prev + message.data.length
            
            // Update metrics
            metricsRef.current.logsReceived = newTotal
            metricsRef.current.updateCount++
            
            // Log performance metrics periodically
            if (metricsRef.current.updateCount % 100 === 0) {
              const elapsed = Date.now() - metricsRef.current.lastUpdateTime
              const logsPerSecond = (message.data.length * 1000) / elapsed
              console.log(`Log streaming performance: ${logsPerSecond.toFixed(1)} logs/sec, Total: ${newTotal}, Buffer: ${logBuffer.size()}/${MAX_LOGS}`)
              
              if (logBuffer.isAtCapacity()) {
                console.warn(`Log buffer at capacity (${MAX_LOGS}). Oldest logs are being dropped.`)
                metricsRef.current.logsDropped += message.data.length
              }
            }
            
            return newTotal
          })
        } else if (message.type === 'error') {
          setError(message.data)
        }
      },
      (error) => {
        setError(error.message)
        isStreamingRef.current = false
        setIsStreaming(false)
      },
      () => {
        // Connected - no need to send query anymore, it's in the URL
        console.log('WebSocket connected for streaming')
      },
      () => {
        // Disconnected
        isStreamingRef.current = false
        setIsStreaming(false)
      },
      // Health change callback
      (newHealth) => {
        updateHealth(newHealth)
      }
    )
    
    ws.connect(buildQuery())
    wsRef.current = ws
    isStreamingRef.current = true
    setIsStreaming(true)
  }, [buildQuery, updateHealth, resetHealth, logBuffer])
  
  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      wsRef.current = null
    }
    isStreamingRef.current = false
    setIsStreaming(false)
  }, [])
  
  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      stopStreaming()
    } else {
      startStreaming()
    }
  }, [isStreaming, startStreaming, stopStreaming])
  
  // Search logs with optimized buffer search
  const searchLogs = useCallback(async (searchTerm: string) => {
    if (!searchTerm) {
      // If no search term, just refresh logs
      fetchLogs()
      return
    }
    
    // First try to search in buffer (fast)
    const bufferedResults = logBuffer.searchInBuffer(searchTerm)
    if (bufferedResults.length > 0) {
      // Found results in buffer, use them immediately
      // FIXED: Actually update the buffer with filtered results
      logBuffer.clear()
      logBuffer.pushBatch(bufferedResults)
      setTotalLogsReceived(bufferedResults.length)
      return
    }
    
    // If not found in buffer, fetch from server
    setLoading(true)
    setError(null)
    
    try {
      const query = buildQuery()
      query.searchTerm = searchTerm
      const response = await LogService.searchLogs(query)
      
      logBuffer.clear()
      logBuffer.pushBatch(response.logs)
      setTotalLogsReceived(response.logs.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search logs')
      logBuffer.clear()
      setTotalLogsReceived(0)
    } finally {
      setLoading(false)
    }
  }, [buildQuery, fetchLogs, logBuffer])
  
  // Clear logs
  const clearLogs = useCallback(() => {
    logBuffer.clear()
    setTotalLogsReceived(0)
    metricsRef.current.logsReceived = 0
    metricsRef.current.logsDropped = 0
  }, [logBuffer])
  
  // Get performance metrics
  const getMetrics = useCallback(() => {
    return {
      totalReceived: metricsRef.current.logsReceived,
      totalDropped: metricsRef.current.logsDropped,
      bufferSize: logBuffer.size(),
      bufferCapacity: MAX_LOGS,
      isAtCapacity: logBuffer.isAtCapacity(),
      updateCount: metricsRef.current.updateCount
    }
  }, [logBuffer])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
      }
    }
  }, [])
  
  // Auto-refresh if enabled
  useEffect(() => {
    if (!filters.autoRefresh || isStreaming) return
    
    const interval = setInterval(() => {
      fetchLogs()
    }, filters.refreshInterval * 1000)
    
    return () => clearInterval(interval)
  }, [filters.autoRefresh, filters.refreshInterval, isStreaming, fetchLogs])
  
  return {
    logs,
    loading,
    error,
    isStreaming,
    connectionHealth: health,
    fetchLogs,
    searchLogs,
    clearLogs,
    toggleStreaming,
    startStreaming,
    stopStreaming,
    getMetrics,
    totalLogsReceived,
    bufferInfo: {
      size: logBuffer.size(),
      capacity: MAX_LOGS,
      isAtCapacity: logBuffer.isAtCapacity()
    }
  }
}
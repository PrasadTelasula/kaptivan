import { useState, useEffect, useCallback, useRef } from 'react'
import type { LogEntry, LogQuery, LogFilters } from '../types/logs'
import { LogService } from '../services/logService'
import { LogWebSocket } from '../services/logWebSocket'
import { useConnectionHealth } from './useConnectionHealth'

export const useLogFetcher = (filters: LogFilters) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  
  const wsRef = useRef<LogWebSocket | null>(null)
  const isStreamingRef = useRef(false)
  const initialLogsRef = useRef<LogEntry[]>([]) // Store initial logs to revert to when streaming stops
  const { health, updateHealth, resetHealth } = useConnectionHealth()
  
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
    if (filters.clusters.length === 0 || filters.namespaces.length === 0 || filters.pods.length === 0 || filters.containers.length === 0) {
      setLogs([])
      initialLogsRef.current = []
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const query = buildQuery()
      const response = await LogService.fetchLogs(query)
      setLogs(response.logs)
      initialLogsRef.current = response.logs // Store as initial logs
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      setLogs([])
      initialLogsRef.current = []
    } finally {
      setLoading(false)
    }
  }, [filters, buildQuery])
  
  // Start streaming
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
      setLogs(response.logs)
      initialLogsRef.current = response.logs // Store initial logs
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch initial logs')
      setLogs([])
      initialLogsRef.current = []
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
          // Append new logs to existing logs (initial + previously streamed)
          setLogs(prev => [...prev, ...message.data])
        } else if (message.type === 'error') {
          setError(message.data)
        }
      },
      (error) => {
        setError(error.message)
        isStreamingRef.current = false
        setIsStreaming(false)
        // Revert to initial logs on error
        setLogs(initialLogsRef.current)
      },
      () => {
        // Connected - send query for streaming
        const query = buildQuery()
        ws.sendQuery(query)
      },
      () => {
        // Disconnected - revert to initial logs
        isStreamingRef.current = false
        setIsStreaming(false)
        setLogs(initialLogsRef.current)
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
  }, [buildQuery, updateHealth, resetHealth])
  
  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      wsRef.current = null
    }
    isStreamingRef.current = false
    setIsStreaming(false)
    // Revert to initial logs (e.g., last 5 minutes) when streaming stops
    setLogs(initialLogsRef.current)
  }, [])
  
  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      stopStreaming()
    } else {
      startStreaming()
    }
  }, [isStreaming, startStreaming, stopStreaming])
  
  // Search logs
  const searchLogs = useCallback(async (searchTerm: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const query = buildQuery()
      query.searchTerm = searchTerm
      const response = await LogService.searchLogs(query)
      setLogs(response.logs)
      initialLogsRef.current = response.logs // Update initial logs ref for search results
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search logs')
      setLogs([])
      initialLogsRef.current = []
    } finally {
      setLoading(false)
    }
  }, [buildQuery])
  
  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([])
    initialLogsRef.current = []
  }, [])
  
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
    stopStreaming
  }
}
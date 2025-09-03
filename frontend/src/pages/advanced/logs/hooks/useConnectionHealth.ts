import { useState, useCallback, useRef, useEffect } from 'react'
import type { ConnectionHealth } from '../types/logs'

const DEFAULT_HEALTH: ConnectionHealth = {
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

export const useConnectionHealth = () => {
  const [health, setHealth] = useState<ConnectionHealth>(DEFAULT_HEALTH)
  const healthRef = useRef<ConnectionHealth>(DEFAULT_HEALTH)
  
  // Update internal ref when health changes
  useEffect(() => {
    healthRef.current = health
  }, [health])
  
  const updateHealth = useCallback((newHealth: ConnectionHealth) => {
    setHealth(newHealth)
  }, [])
  
  const resetHealth = useCallback(() => {
    setHealth(DEFAULT_HEALTH)
  }, [])
  
  const getCurrentHealth = useCallback(() => {
    return healthRef.current
  }, [])
  
  return {
    health,
    updateHealth,
    resetHealth,
    getCurrentHealth
  }
}
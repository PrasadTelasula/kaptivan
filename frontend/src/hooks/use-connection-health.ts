import { useState, useEffect } from 'react'

interface ConnectionHealthData {
  isConnected: boolean
  latency: number | null
  messageCount: number
  connectedAt: Date
}

export function useConnectionHealth(initialConnected = true): ConnectionHealthData {
  const [isConnected, setIsConnected] = useState(initialConnected)
  const [latency, setLatency] = useState<number | null>(initialConnected ? 45 : null)
  const [messageCount, setMessageCount] = useState(1247)
  const [connectedAt] = useState(new Date(Date.now() - 39000)) // 39 seconds ago

  useEffect(() => {
    // Simulate connection changes and real-time updates
    const interval = setInterval(() => {
      if (isConnected) {
        // Simulate latency fluctuations (20-150ms range)
        if (Math.random() > 0.3) {
          const newLatency = Math.floor(Math.random() * 130) + 20
          setLatency(newLatency)
        }

        // Simulate message count increases
        if (Math.random() > 0.6) {
          setMessageCount(prev => prev + Math.floor(Math.random() * 5) + 1)
        }

        // Rarely go offline (2% chance)
        if (Math.random() < 0.02) {
          setIsConnected(false)
          setLatency(null)
        }
      } else {
        // When offline, occasionally reconnect (10% chance)
        if (Math.random() < 0.1) {
          setIsConnected(true)
          setLatency(Math.floor(Math.random() * 100) + 30)
        }
      }
    }, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [isConnected])

  return {
    isConnected,
    latency,
    messageCount,
    connectedAt
  }
}
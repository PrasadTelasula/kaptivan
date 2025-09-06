import { useRef, useCallback, useMemo } from 'react'

/**
 * Circular buffer implementation for efficient log storage
 * Prevents memory issues with large log volumes
 */
export interface CircularBuffer<T> {
  push: (item: T) => void
  pushBatch: (items: T[]) => void
  getAll: () => T[]
  getSlice: (start: number, end: number) => T[]
  clear: () => void
  size: () => number
  capacity: number
}

export function useCircularBuffer<T>(maxSize: number): CircularBuffer<T> {
  const bufferRef = useRef<T[]>([])
  const headRef = useRef(0) // Points to the next write position
  const sizeRef = useRef(0) // Current number of items in buffer
  
  const push = useCallback((item: T) => {
    if (bufferRef.current.length < maxSize) {
      // Buffer is not full yet, just append
      bufferRef.current.push(item)
      sizeRef.current++
    } else {
      // Buffer is full, overwrite oldest item
      bufferRef.current[headRef.current] = item
      headRef.current = (headRef.current + 1) % maxSize
    }
  }, [maxSize])
  
  const pushBatch = useCallback((items: T[]) => {
    if (items.length === 0) return
    
    if (items.length >= maxSize) {
      // If batch is larger than buffer, only keep the last maxSize items
      bufferRef.current = items.slice(-maxSize)
      headRef.current = 0
      sizeRef.current = maxSize
      return
    }
    
    if (bufferRef.current.length < maxSize) {
      // Buffer is not full yet
      const remainingSpace = maxSize - bufferRef.current.length
      if (items.length <= remainingSpace) {
        // All items fit
        bufferRef.current.push(...items)
        sizeRef.current += items.length
      } else {
        // Some items fit, others need to overwrite
        bufferRef.current.push(...items.slice(0, remainingSpace))
        sizeRef.current = maxSize
        
        // Overwrite oldest with remaining items
        const remaining = items.slice(remainingSpace)
        for (let i = 0; i < remaining.length; i++) {
          bufferRef.current[headRef.current] = remaining[i]
          headRef.current = (headRef.current + 1) % maxSize
        }
      }
    } else {
      // Buffer is full, need to overwrite
      for (let i = 0; i < items.length; i++) {
        bufferRef.current[headRef.current] = items[i]
        headRef.current = (headRef.current + 1) % maxSize
      }
    }
  }, [maxSize])
  
  const getAll = useCallback((): T[] => {
    if (bufferRef.current.length < maxSize) {
      // Buffer is not full, return as is (newest at end)
      return [...bufferRef.current]
    }
    
    // Buffer is full, need to reconstruct in correct order
    // Items from head to end, then from start to head-1
    const result: T[] = []
    
    // Add items from head to end (oldest)
    for (let i = headRef.current; i < maxSize; i++) {
      result.push(bufferRef.current[i])
    }
    
    // Add items from start to head-1 (newest)
    for (let i = 0; i < headRef.current; i++) {
      result.push(bufferRef.current[i])
    }
    
    return result
  }, [maxSize])
  
  const getSlice = useCallback((start: number, end: number): T[] => {
    const all = getAll()
    return all.slice(start, end)
  }, [getAll])
  
  const clear = useCallback(() => {
    bufferRef.current = []
    headRef.current = 0
    sizeRef.current = 0
  }, [])
  
  const size = useCallback(() => {
    return Math.min(sizeRef.current, maxSize)
  }, [maxSize])
  
  return useMemo(() => ({
    push,
    pushBatch,
    getAll,
    getSlice,
    clear,
    size,
    capacity: maxSize
  }), [push, pushBatch, getAll, getSlice, clear, size, maxSize])
}

/**
 * Hook for managing logs with a circular buffer
 * Optimized for high-volume log streaming
 */
export function useLogBuffer(maxSize: number = 10000) {
  const buffer = useCircularBuffer<any>(maxSize)
  
  // Track if we're at capacity (for UI indicators)
  const isAtCapacity = useCallback(() => {
    return buffer.size() >= maxSize
  }, [buffer, maxSize])
  
  // Get recent logs (for display)
  const getRecentLogs = useCallback((count: number) => {
    const all = buffer.getAll()
    return all.slice(-count)
  }, [buffer])
  
  // Get logs for virtualization window
  const getWindowedLogs = useCallback((startIndex: number, endIndex: number) => {
    return buffer.getSlice(startIndex, endIndex)
  }, [buffer])
  
  // Search within buffer
  const searchInBuffer = useCallback((searchTerm: string) => {
    if (!searchTerm) return buffer.getAll()
    
    const lowerSearch = searchTerm.toLowerCase()
    return buffer.getAll().filter(log => 
      log.message?.toLowerCase().includes(lowerSearch) ||
      log.pod?.toLowerCase().includes(lowerSearch) ||
      log.container?.toLowerCase().includes(lowerSearch)
    )
  }, [buffer])
  
  return {
    ...buffer,
    isAtCapacity,
    getRecentLogs,
    getWindowedLogs,
    searchInBuffer
  }
}
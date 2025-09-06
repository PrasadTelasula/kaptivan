import { renderHook, act } from '@testing-library/react'
import { useCircularBuffer, useLogBuffer } from '../useCircularBuffer'

describe('useCircularBuffer', () => {
  it('should initialize with empty buffer', () => {
    const { result } = renderHook(() => useCircularBuffer(100))
    
    expect(result.current.size()).toBe(0)
    expect(result.current.capacity).toBe(100)
    expect(result.current.getAll()).toEqual([])
  })
  
  it('should add items to buffer', () => {
    const { result } = renderHook(() => useCircularBuffer(5))
    
    act(() => {
      result.current.push('log1')
      result.current.push('log2')
      result.current.push('log3')
    })
    
    expect(result.current.size()).toBe(3)
    expect(result.current.getAll()).toEqual(['log1', 'log2', 'log3'])
  })
  
  it('should overwrite oldest items when buffer is full', () => {
    const { result } = renderHook(() => useCircularBuffer(3))
    
    act(() => {
      result.current.push('log1')
      result.current.push('log2')
      result.current.push('log3')
      result.current.push('log4') // Should overwrite log1
      result.current.push('log5') // Should overwrite log2
    })
    
    expect(result.current.size()).toBe(3)
    expect(result.current.getAll()).toEqual(['log3', 'log4', 'log5'])
  })
  
  it('should handle batch push efficiently', () => {
    const { result } = renderHook(() => useCircularBuffer(5))
    
    act(() => {
      result.current.pushBatch(['log1', 'log2', 'log3'])
    })
    
    expect(result.current.size()).toBe(3)
    expect(result.current.getAll()).toEqual(['log1', 'log2', 'log3'])
    
    act(() => {
      result.current.pushBatch(['log4', 'log5', 'log6', 'log7'])
    })
    
    // Should keep only the last 5
    expect(result.current.size()).toBe(5)
    expect(result.current.getAll()).toEqual(['log3', 'log4', 'log5', 'log6', 'log7'])
  })
  
  it('should handle very large batches', () => {
    const { result } = renderHook(() => useCircularBuffer(100))
    
    const largeBatch = Array.from({ length: 1000 }, (_, i) => `log${i}`)
    
    act(() => {
      result.current.pushBatch(largeBatch)
    })
    
    // Should keep only the last 100
    expect(result.current.size()).toBe(100)
    const all = result.current.getAll()
    expect(all[0]).toBe('log900')
    expect(all[99]).toBe('log999')
  })
  
  it('should clear buffer', () => {
    const { result } = renderHook(() => useCircularBuffer(5))
    
    act(() => {
      result.current.pushBatch(['log1', 'log2', 'log3'])
    })
    
    expect(result.current.size()).toBe(3)
    
    act(() => {
      result.current.clear()
    })
    
    expect(result.current.size()).toBe(0)
    expect(result.current.getAll()).toEqual([])
  })
})

describe('useLogBuffer', () => {
  const mockLog = (id: number) => ({
    message: `Log message ${id}`,
    pod: `pod-${id}`,
    container: `container-${id}`,
    timestamp: new Date().toISOString(),
    level: 'INFO',
    cluster: 'test-cluster',
    namespace: 'default',
    lineNumber: id,
    source: 'stdout'
  })
  
  it('should track capacity status', () => {
    const { result } = renderHook(() => useLogBuffer(3))
    
    expect(result.current.isAtCapacity()).toBe(false)
    
    act(() => {
      result.current.pushBatch([mockLog(1), mockLog(2)])
    })
    
    expect(result.current.isAtCapacity()).toBe(false)
    
    act(() => {
      result.current.push(mockLog(3))
    })
    
    expect(result.current.isAtCapacity()).toBe(true)
  })
  
  it('should search within buffer', () => {
    const { result } = renderHook(() => useLogBuffer(100))
    
    act(() => {
      result.current.pushBatch([
        { ...mockLog(1), message: 'Error in authentication' },
        { ...mockLog(2), message: 'Success response' },
        { ...mockLog(3), message: 'Warning: slow query' },
        { ...mockLog(4), message: 'Error in database' },
      ])
    })
    
    const errorLogs = result.current.searchInBuffer('error')
    expect(errorLogs).toHaveLength(2)
    expect(errorLogs[0].message).toContain('Error')
    expect(errorLogs[1].message).toContain('Error')
  })
  
  it('should get windowed logs for virtualization', () => {
    const { result } = renderHook(() => useLogBuffer(100))
    
    const logs = Array.from({ length: 50 }, (_, i) => mockLog(i))
    
    act(() => {
      result.current.pushBatch(logs)
    })
    
    const window = result.current.getWindowedLogs(10, 20)
    expect(window).toHaveLength(10)
    expect(window[0].lineNumber).toBe(10)
    expect(window[9].lineNumber).toBe(19)
  })
})
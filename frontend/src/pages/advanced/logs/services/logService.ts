import type { LogQuery, LogResponse } from '../types/logs'

const API_BASE_URL = 'http://localhost:8080/api/v1'

export class LogService {
  static async fetchLogs(query: LogQuery): Promise<LogResponse> {
    const params = new URLSearchParams()
    
    // Add query parameters
    query.clusters.forEach(c => params.append('clusters', c))
    query.namespaces.forEach(ns => params.append('namespaces', ns))
    query.pods.forEach(p => params.append('pods', p))
    query.containers?.forEach(c => params.append('containers', c))
    query.logLevels.forEach(l => params.append('logLevels', l))
    
    if (query.searchTerm) params.append('searchTerm', query.searchTerm)
    if (query.limit) params.append('limit', query.limit.toString())
    if (query.tail) params.append('tail', query.tail.toString())
    if (query.startTime) params.append('startTime', query.startTime.toISOString())
    if (query.endTime) params.append('endTime', query.endTime.toISOString())
    
    const response = await fetch(`${API_BASE_URL}/logs/?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  static async searchLogs(query: LogQuery): Promise<LogResponse> {
    const response = await fetch(`${API_BASE_URL}/logs/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to search logs: ${response.statusText}`)
    }
    
    return response.json()
  }
}
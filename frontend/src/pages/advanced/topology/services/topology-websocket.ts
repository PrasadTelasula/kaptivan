export type ResourceChangeType = 'added' | 'modified' | 'deleted';

export interface ResourceChange {
  type: ResourceChangeType;
  resourceType: string; // deployment, pod, service, etc.
  resourceId: string;
  namespace: string;
  data?: any; // The updated resource data
  timestamp: string;
}

export interface TopologyUpdate {
  changes: ResourceChange[];
  timestamp: string;
}

export class TopologyWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Set<(update: TopologyUpdate) => void> = new Set();
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private baseUrl: string,
    private context: string,
    private namespace: string,
    private resourceName?: string,
    private resourceType: 'deployment' | 'daemonset' | 'job' = 'deployment'
  ) {
    // Convert HTTP URL to WebSocket URL
    const wsUrl = baseUrl.replace('http', 'ws');
    this.url = `${wsUrl}/api/v1/topology/ws/${context}/${namespace}`;
    if (resourceName) {
      this.url += `?${resourceType}=${resourceName}`;
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('Topology WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Send initial subscription message
      const subscriptionMsg: any = {
        type: 'subscribe',
        namespace: this.namespace
      };
      
      if (this.resourceName) {
        subscriptionMsg[this.resourceType] = this.resourceName;
      }
      
      this.ws?.send(JSON.stringify(subscriptionMsg));
    };

    this.ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as TopologyUpdate;
        this.notifyListeners(update);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnected = false;
    };

    this.ws.onclose = () => {
      console.log('Topology WebSocket disconnected');
      this.isConnected = false;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  private notifyListeners(update: TopologyUpdate): void {
    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('Error in topology update listener:', error);
      }
    });
  }

  onUpdate(listener: (update: TopologyUpdate) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.listeners.clear();
  }

  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  // Send a manual refresh request
  refresh(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const refreshMsg: any = {
        type: 'refresh',
        namespace: this.namespace
      };
      
      if (this.resourceName) {
        refreshMsg[this.resourceType] = this.resourceName;
      }
      
      this.ws.send(JSON.stringify(refreshMsg));
    }
  }
}
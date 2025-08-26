export class LogsWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: (line: string) => void;
  private onError: (error: string) => void;
  private onClose: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    url: string,
    onMessage: (line: string) => void,
    onError: (error: string) => void,
    onClose: () => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Logs WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.error) {
            this.onError(message.error);
          } else if (message.type === 'log') {
            // Extract the actual log line from the data field
            this.onMessage(message.data);
          } else if (message.type === 'end') {
            console.log('Log stream ended:', message.message);
          }
        } catch (err) {
          // If it's not JSON, treat it as a plain log line
          this.onMessage(event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          // Attempt to reconnect
          this.reconnectAttempts++;
          setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        } else {
          this.onClose();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.onError('Failed to connect to log stream');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
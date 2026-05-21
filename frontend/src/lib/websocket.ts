export interface ScanEvent {
  event_type: 'progress' | 'completed' | 'failed' | 'started'
  scan_id: string
  progress: number
  message: string
  data: Record<string, unknown>
}

export class ScanWebSocket {
  private scanId: string
  private onEvent: (event: ScanEvent) => void
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  constructor(scanId: string, onEvent: (event: ScanEvent) => void) {
    this.scanId = scanId
    this.onEvent = onEvent
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    this.shouldReconnect = true
    this.reconnectAttempts = 0
    this._connect()
  }

  private _connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = 8000
    const url = `${protocol}//${host}:${port}/api/scan/ws/${this.scanId}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as ScanEvent
          this.onEvent(data)

          if (
            data.event_type === 'completed' ||
            data.event_type === 'failed'
          ) {
            this.shouldReconnect = false
            this.disconnect()
          }
        } catch {
          // Ignore malformed messages
        }
      }

      this.ws.onerror = () => {
        // onclose will handle reconnection
      }

      this.ws.onclose = () => {
        if (
          this.shouldReconnect &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++
          const delay = Math.min(1000 * this.reconnectAttempts, 5000)
          this.reconnectTimer = setTimeout(() => {
            this._connect()
          }, delay)
        } else if (
          this.reconnectAttempts >= this.maxReconnectAttempts
        ) {
          this.onEvent({
            event_type: 'failed',
            scan_id: this.scanId,
            progress: 0,
            message: 'WebSocket connection failed after maximum retries',
            data: {},
          })
        }
      }
    } catch {
      this.onEvent({
        event_type: 'failed',
        scan_id: this.scanId,
        progress: 0,
        message: 'Failed to create WebSocket connection',
        data: {},
      })
    }
  }

  disconnect(): void {
    this.shouldReconnect = false

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close()
      }

      this.ws = null
    }
  }
}

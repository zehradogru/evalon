import type {
    StreamSubscription,
    StreamEvent,
    CandleData,
    TimeFrame,
} from '@graph/shared-types';

const WS_BASE = import.meta.env.VITE_WS_BASE || (() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/v1/stream`;
})();

/**
 * RealtimeStream — WebSocket connection manager for real-time bar updates.
 * Handles auto-reconnect with exponential backoff + jitter.
 */
export class RealtimeStream {
    private ws: WebSocket | null = null;
    private symbol: string = '';
    private tf: TimeFrame = '1h';
    private reconnectAttempt: number = 0;
    private maxReconnectDelay: number = 30000;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isAlive: boolean = false;
    private pingInterval: ReturnType<typeof setInterval> | null = null;

    /** Called when a bar is updated */
    onBarUpdate?: (data: CandleData) => void;
    /** Called when a new bar is created */
    onNewBar?: (data: CandleData) => void;
    /** Called on connection status change */
    onConnectionChange?: (connected: boolean) => void;

    /** Subscribe to a symbol/timeframe stream */
    subscribe(symbol: string, tf: TimeFrame): void {
        this.symbol = symbol;
        this.tf = tf;
        this.connect();
    }

    /** Unsubscribe and disconnect */
    unsubscribe(): void {
        this.cleanup();
    }

    private connect(): void {
        this.cleanup();

        try {
            this.ws = new WebSocket(WS_BASE);

            this.ws.onopen = () => {
                this.reconnectAttempt = 0;
                this.isAlive = true;
                this.onConnectionChange?.(true);

                // Send subscription message
                const sub: StreamSubscription = {
                    action: 'subscribe',
                    symbol: this.symbol,
                    tf: this.tf,
                };
                this.ws!.send(JSON.stringify(sub));

                // Keep-alive ping
                this.pingInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ action: 'ping' }));
                    }
                }, 30000);
            };

            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const msg: StreamEvent = JSON.parse(event.data);

                    if (msg.type === 'bar_update') {
                        this.onBarUpdate?.(msg.data);
                    } else if (msg.type === 'new_bar') {
                        this.onNewBar?.(msg.data);
                    }
                } catch (err) {
                    console.error('[RealtimeStream] parse error:', err);
                }
            };

            this.ws.onclose = () => {
                this.isAlive = false;
                this.onConnectionChange?.(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.error('[RealtimeStream] ws error:', err);
                this.ws?.close();
            };
        } catch (err) {
            console.error('[RealtimeStream] connect error:', err);
            this.scheduleReconnect();
        }
    }

    /** Exponential backoff with jitter */
    private scheduleReconnect(): void {
        const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
        const jitter = Math.random() * baseDelay * 0.3;
        const delay = baseDelay + jitter;

        this.reconnectAttempt++;
        console.log(`[RealtimeStream] reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);

        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    private cleanup(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
    }

    isConnected(): boolean {
        return this.isAlive;
    }

    destroy(): void {
        this.cleanup();
    }
}

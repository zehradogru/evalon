import type {
    BridgeMessage,
    BridgeCommandType,
    BridgeEventType,
    AckPayload,
    ErrorPayload,
} from '@graph/shared-types';

/**
 * BridgeManager — handles WebView bridge communication.
 * Detects platform (iOS / Android / Web), routes messages between
 * native app and chart client.
 */

type CommandHandler = (payload: any) => void;

export class BridgeManager {
    private handlers = new Map<BridgeCommandType, CommandHandler>();
    private pendingAcks = new Map<string, { resolve: Function; timer: number }>();
    private messageCounter = 0;

    constructor() {
        this.setupReceiver();
    }

    /** Register a handler for a native → web command */
    onCommand<T>(type: BridgeCommandType, handler: (payload: T) => void): void {
        this.handlers.set(type, handler);
    }

    /** Send an event from web → native */
    sendEvent<T>(type: BridgeEventType, payload: T): void {
        const msg: BridgeMessage<T> = {
            id: this.generateId(),
            type,
            payload,
            ts: Date.now(),
        };

        this.postToNative(msg);
    }

    /** Send ACK for a received command */
    sendAck(commandId: string, success: boolean = true): void {
        const msg: BridgeMessage<AckPayload> = {
            id: commandId,
            type: 'ack',
            payload: { success },
            ts: Date.now(),
        };
        this.postToNative(msg);
    }

    /** Send error response for a received command */
    sendError(commandId: string, code: string, message: string): void {
        const msg: BridgeMessage<ErrorPayload> = {
            id: commandId,
            type: 'error',
            payload: { code, message },
            ts: Date.now(),
        };
        this.postToNative(msg);
    }

    /** Emit the 'ready' event to signal chart initialization is complete */
    emitReady(version: string, lwcVersion: string): void {
        this.sendEvent('ready', { version, lwcVersion });
    }

    /** Detect if running inside a WebView */
    isWebView(): boolean {
        return this.isIOS() || this.isAndroid();
    }

    private isIOS(): boolean {
        return !!(window as any).webkit?.messageHandlers?.chartBridge;
    }

    private isAndroid(): boolean {
        return !!(window as any).ChartBridgeNative;
    }

    /** Set up the global receiver for native → web messages */
    private setupReceiver(): void {
        (window as any).ChartBridge = {
            receive: (msg: BridgeMessage | string) => {
                const parsed: BridgeMessage = typeof msg === 'string' ? JSON.parse(msg) : msg;
                this.handleIncoming(parsed);
            },
        };
    }

    /** Route incoming messages to handlers */
    private handleIncoming(msg: BridgeMessage): void {
        // Handle ACK responses
        if (msg.type === 'ack' || msg.type === 'error') {
            const pending = this.pendingAcks.get(msg.id);
            if (pending) {
                clearTimeout(pending.timer);
                pending.resolve(msg);
                this.pendingAcks.delete(msg.id);
            }
            return;
        }

        // Route commands to handlers
        const handler = this.handlers.get(msg.type as BridgeCommandType);
        if (handler) {
            try {
                handler(msg.payload);
                this.sendAck(msg.id);
            } catch (err: any) {
                console.error(`[Bridge] command ${msg.type} failed:`, err);
                this.sendError(msg.id, 'HANDLER_ERROR', err.message || 'Unknown error');
            }
        } else {
            console.warn(`[Bridge] no handler for command: ${msg.type}`);
            this.sendError(msg.id, 'UNKNOWN_COMMAND', `No handler for ${msg.type}`);
        }
    }

    /** Post message to native layer (platform-aware) */
    private postToNative(msg: BridgeMessage): void {
        try {
            if (this.isIOS()) {
                (window as any).webkit.messageHandlers.chartBridge.postMessage(msg);
            } else if (this.isAndroid()) {
                (window as any).ChartBridgeNative.postMessage(JSON.stringify(msg));
            } else {
                // Web fallback: dispatch custom event for testing / non-WebView usage
                window.dispatchEvent(new CustomEvent('chart-bridge-event', { detail: msg }));
            }
        } catch (err) {
            console.error('[Bridge] postToNative failed:', err);
        }
    }

    private generateId(): string {
        return `msg_${Date.now()}_${++this.messageCounter}`;
    }
}

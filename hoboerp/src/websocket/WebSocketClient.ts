import {API_BASE_URL} from '../config/api';
import {featureFlags} from '../config/featureFlags';
import {WebSocketEvents, type WebSocketEventName} from './channels';

type Handler = (payload: Record<string, unknown>) => void;

class MobileWebSocketClient {
  private handlers = new Map<WebSocketEventName, Set<Handler>>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private socket: WebSocket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (!featureFlags.enableRealtimeSockets) {
      return;
    }

    if (
      this.socket &&
      this.token === token &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.disconnect({allowReconnect: false});
    this.token = token;
    this.shouldReconnect = true;
    this.socket = new WebSocket(this.buildUrl(token));
    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit(WebSocketEvents.CONNECTION_ACK, {
        event: WebSocketEvents.CONNECTION_ACK,
      });
    };
    this.socket.onmessage = event => this.handleMessage(event);
    this.socket.onerror = () => {
      this.emit('*', {event: 'socket_error'});
    };
    this.socket.onclose = () => {
      this.emit('*', {event: 'socket_closed'});
      if (this.shouldReconnect && this.token) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(options: {allowReconnect?: boolean} = {}) {
    this.shouldReconnect = Boolean(options.allowReconnect);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  onEvent(event: WebSocketEventName, handler: Handler) {
    const handlers = this.handlers.get(event) ?? new Set<Handler>();
    handlers.add(handler);
    this.handlers.set(event, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  private buildUrl(token: string) {
    const wsBase = API_BASE_URL.replace(/^https:/, 'wss:').replace(
      /^http:/,
      'ws:',
    );
    return `${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`;
  }

  private emit(event: WebSocketEventName, payload: Record<string, unknown>) {
    this.handlers.get(event)?.forEach(handler => handler(payload));
    if (event !== '*') {
      this.handlers.get('*')?.forEach(handler => handler(payload));
    }
  }

  private handleMessage(message: {data?: unknown}) {
    try {
      const payload = JSON.parse(String(message.data)) as Record<string, unknown>;
      const event =
        typeof payload.event === 'string'
          ? payload.event
          : typeof payload.type === 'string'
            ? payload.type
            : '*';

      this.emit(event as WebSocketEventName, payload);
    } catch {
      this.emit('*', {event: 'parse_error'});
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }
}

export const mobileWebSocketClient = new MobileWebSocketClient();

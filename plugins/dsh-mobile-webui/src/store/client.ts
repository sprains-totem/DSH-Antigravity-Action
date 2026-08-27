import { ConnectionState } from './types';

export interface RpcResponse<T = any> {
  ok: boolean;
  value?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export type MuxFrameHandler = (payload: any, rpcId?: string) => void;
export type HostFrameHandler = (payload: any, rpcId?: string) => void;
export type StateChangeHandler = (state: ConnectionState) => void;

export class DshClient {
  private baseUrl: string;
  private wsBaseUrl: string;
  private muxSocket: WebSocket | null = null;
  private hostSocket: WebSocket | null = null;
  private state: ConnectionState = 'offline';
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private reconnectAttempt = 0;
  private isDestroyed = false;

  public onMuxFrame: MuxFrameHandler | null = null;
  public onHostFrame: HostFrameHandler | null = null;
  public onStateChange: StateChangeHandler | null = null;

  constructor() {
    const loc = window.location;
    this.baseUrl = `${loc.protocol}//${loc.host}`;
    this.wsBaseUrl = `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}`;

    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners() {
    // 1. Mobile Visibility Change: when phone unlocks or switches back to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[mobile-client] Tab became visible, verifying WebSocket connection');
        this.verifyAndReconnect();
      }
    });

    // 2. Network Online Event (e.g. WiFi -> 5G switch)
    window.addEventListener('online', () => {
      console.log('[mobile-client] Network online event detected');
      this.verifyAndReconnect();
    });

    window.addEventListener('offline', () => {
      console.log('[mobile-client] Network offline event detected');
      this.setState('offline');
    });

    // 3. Periodic Keepalive (every 30s) to prevent carrier NAT drops & Cloudflare 100s idle timeout
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && document.visibilityState === 'visible') {
        this.ping();
      }
    }, 30000);
  }

  public start() {
    this.isDestroyed = false;
    this.connect();
  }

  public stop() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.closeSockets();
    this.setState('offline');
  }

  private closeSockets() {
    if (this.muxSocket) {
      try { this.muxSocket.close(); } catch {}
      this.muxSocket = null;
    }
    if (this.hostSocket) {
      try { this.hostSocket.close(); } catch {}
      this.hostSocket = null;
    }
  }

  private setState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChange?.(newState);
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public async rpc<T = any>(method: string, payload: any = {}, timeoutMs = 15000): Promise<T> {
    const rpcId = this.generateId();
    const body = {
      type: 'client-request',
      rpcId,
      method,
      payload,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(`${this.baseUrl}/api/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const json = await resp.json();
      if (json.type === 'server-response') {
        if (!json.result.ok) {
          const err = json.result.error;
          throw new Error(`[${err.code}] ${err.message}`);
        }
        return json.result.value as T;
      }
      return json as T;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`RPC ${method} timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  public async respond(rpcId: string, value: any): Promise<boolean> {
    const body = {
      rpcId,
      result: {
        ok: true,
        value,
      },
    };

    try {
      const resp = await fetch(`${this.baseUrl}/api/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      return data.accepted === true;
    } catch (e) {
      console.error('[mobile-client] respond error:', e);
      return false;
    }
  }

  private async ping() {
    try {
      // Lightweight call to keep connection warm
      await this.rpc('host.describe', {}, 5000);
    } catch (e) {
      console.warn('[mobile-client] Keepalive ping failed, reconnecting...');
      this.verifyAndReconnect();
    }
  }

  public verifyAndReconnect() {
    if (this.isDestroyed) return;
    const isMuxAlive = this.muxSocket && this.muxSocket.readyState === WebSocket.OPEN;
    const isHostAlive = this.hostSocket && this.hostSocket.readyState === WebSocket.OPEN;

    if (!isMuxAlive || !isHostAlive) {
      console.log('[mobile-client] WebSockets not fully alive, reconnecting...');
      this.reconnect();
    }
  }

  private connect() {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    this.closeSockets();

    let muxReady = false;
    let hostReady = false;

    const checkReady = () => {
      if (muxReady && hostReady) {
        this.reconnectAttempt = 0;
        this.setState('connected');
        console.log('[mobile-client] Both WebSockets connected and ready');
      }
    };

    try {
      // 1. Mux WebSocket for session events, chunks, approvals, projections
      const muxUrl = `${this.wsBaseUrl}/api/events.mux`;
      this.muxSocket = new WebSocket(muxUrl);

      this.muxSocket.onopen = () => {
        muxReady = true;
        checkReady();
      };

      this.muxSocket.onmessage = (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const msg = JSON.parse(event.data);
          if (msg.type === 'server-request' && msg.payload) {
            this.onMuxFrame?.(msg.payload, msg.rpcId);
          }
        } catch (e) {
          console.error('[mobile-client] Error parsing mux frame:', e);
        }
      };

      this.muxSocket.onclose = () => {
        if (!this.isDestroyed) {
          this.scheduleReconnect('mux closed');
        }
      };

      this.muxSocket.onerror = (err) => {
        console.warn('[mobile-client] Mux WebSocket error:', err);
      };

      // 2. Host WebSocket for host/remote events
      const hostUrl = `${this.wsBaseUrl}/api/events.host`;
      this.hostSocket = new WebSocket(hostUrl);

      this.hostSocket.onopen = () => {
        hostReady = true;
        checkReady();
      };

      this.hostSocket.onmessage = (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const msg = JSON.parse(event.data);
          if (msg.type === 'server-request' && msg.payload) {
            this.onHostFrame?.(msg.payload, msg.rpcId);
          }
        } catch (e) {
          console.error('[mobile-client] Error parsing host frame:', e);
        }
      };

      this.hostSocket.onclose = () => {
        if (!this.isDestroyed) {
          this.scheduleReconnect('host closed');
        }
      };

      this.hostSocket.onerror = (err) => {
        console.warn('[mobile-client] Host WebSocket error:', err);
      };
    } catch (err) {
      console.error('[mobile-client] Connection creation error:', err);
      this.scheduleReconnect('connection error');
    }
  }

  private scheduleReconnect(reason = '') {
    if (this.isDestroyed || this.reconnectTimer) return;

    this.setState('reconnecting');
    this.reconnectAttempt++;

    // Backoff delay: min 500ms, max 8000ms with jitter
    const delay = Math.min(8000, 500 * Math.pow(1.5, this.reconnectAttempt - 1)) + Math.random() * 500;
    console.log(`[mobile-client] Reconnecting in ${Math.round(delay)}ms (attempt #${this.reconnectAttempt}) - reason: ${reason}`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public reconnect() {
    this.closeSockets();
    this.connect();
  }

  public generateId(): string {
    return 'm_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
  }
}

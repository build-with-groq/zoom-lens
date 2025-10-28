/**
 * WebSocket Core Utilities
 * Generic WebSocket handling utilities
 */

/**
 * Connection Manager
 * Manages active WebSocket connections
 */
export class ConnectionManager {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Add a connection
   * @param {string} key - Connection identifier
   * @param {string} type - Connection type (e.g., 'signaling', 'media')
   * @param {WebSocket} ws - WebSocket instance
   * @returns {void}
   */
  addConnection(key, type, ws) {
    if (!this.connections.has(key)) {
      this.connections.set(key, {});
    }
    this.connections.get(key)[type] = ws;
    console.log(`🔌 Connection added: ${key} (${type})`);
  }

  /**
   * Get a connection
   * @param {string} key - Connection identifier
   * @param {string} type - Connection type
   * @returns {WebSocket|null}
   */
  getConnection(key, type) {
    const conn = this.connections.get(key);
    return conn ? conn[type] : null;
  }

  /**
   * Remove a specific connection type
   * @param {string} key - Connection identifier
   * @param {string} type - Connection type
   * @returns {void}
   */
  removeConnection(key, type) {
    const conn = this.connections.get(key);
    if (conn && conn[type]) {
      conn[type].close();
      delete conn[type];
      console.log(`🔌 Connection removed: ${key} (${type})`);

      // If no more connections for this key, remove the key
      if (Object.keys(conn).length === 0) {
        this.connections.delete(key);
      }
    }
  }

  /**
   * Remove all connections for a key
   * @param {string} key - Connection identifier
   * @returns {void}
   */
  removeAll(key) {
    const conn = this.connections.get(key);
    if (conn) {
      Object.values(conn).forEach(ws => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      this.connections.delete(key);
      console.log(`🔌 All connections removed: ${key}`);
    }
  }

  /**
   * Clear all connections
   * @returns {void}
   */
  clear() {
    this.connections.forEach((conn, key) => {
      this.removeAll(key);
    });
    console.log('🔌 All connections cleared');
  }

  /**
   * Get all connection keys
   * @returns {Array<string>}
   */
  getKeys() {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection count
   * @returns {number}
   */
  size() {
    return this.connections.size;
  }
}

/**
 * Normalize WebSocket server URLs
 * Handles various formats: string, array, object with 'all' property
 * @param {string|Array|Object} server_urls - Server URLs in various formats
 * @returns {string|null} Normalized WebSocket URL
 */
export function resolveWsUrl(server_urls) {
  try {
    if (!server_urls) return null;
    if (typeof server_urls === 'string') return server_urls;
    if (server_urls.all) return server_urls.all;
    if (Array.isArray(server_urls) && server_urls.length > 0) return server_urls[0];
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse WebSocket event data (handles multiple formats)
 * Supports: string, Blob, ArrayBuffer, Uint8Array, Buffer
 * @param {string|Blob|ArrayBuffer|Uint8Array|Buffer} data - WebSocket event data
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function parseWsJson(data) {
  try {
    if (typeof data === 'string') return JSON.parse(data);
    if (data instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(data));
    if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      const text = await data.text();
      return JSON.parse(text);
    }
    // Handle Buffer (Node.js style) - might be what Deno uses
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return JSON.parse(data.toString());
    }
    throw new Error('Unsupported WebSocket data type: ' + Object.prototype.toString.call(data));
  } catch (err) {
    throw err;
  }
}

/**
 * Transcript Store
 * Manages recent transcripts with automatic size limiting
 */
export class TranscriptStore {
  constructor(maxSize = 50) {
    this.transcripts = [];
    this.maxSize = maxSize;
  }

  /**
   * Add a transcript to the store
   * @param {Object} transcript - Transcript object to add
   * @returns {void}
   */
  add(transcript) {
    this.transcripts.unshift(transcript);

    // Keep only last N transcripts to prevent memory issues
    if (this.transcripts.length > this.maxSize) {
      this.transcripts = this.transcripts.slice(0, this.maxSize);
    }
  }

  /**
   * Get all transcripts
   * @returns {Array} Array of transcripts
   */
  getAll() {
    return [...this.transcripts];
  }

  /**
   * Get recent transcripts (since a specific timestamp)
   * @param {number} since - Timestamp to filter from
   * @returns {Array} Array of filtered transcripts
   */
  getSince(since) {
    return this.transcripts.filter(t => t.timestamp > since);
  }

  /**
   * Get the N most recent transcripts
   * @param {number} limit - Number of transcripts to return
   * @returns {Array} Array of recent transcripts
   */
  getRecent(limit) {
    return this.transcripts.slice(0, limit);
  }

  /**
   * Clear all transcripts
   * @returns {void}
   */
  clear() {
    this.transcripts = [];
  }

  /**
   * Get transcript count
   * @returns {number}
   */
  size() {
    return this.transcripts.length;
  }
}

/**
 * WebSocket connection helper with automatic reconnection
 * @param {string} url - WebSocket URL
 * @param {Object} options - Connection options
 * @returns {WebSocket} WebSocket instance
 */
export function createWebSocketConnection(url, options = {}) {
  const {
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnect = false,
    reconnectDelay = 5000,
    maxReconnectAttempts = 3
  } = options;

  let reconnectAttempts = 0;
  let ws;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = (event) => {
      console.log(`🔌 WebSocket connected: ${url}`);
      reconnectAttempts = 0; // Reset reconnect counter on successful connection
      if (onOpen) onOpen(event);
    };

    ws.onmessage = (event) => {
      if (onMessage) onMessage(event);
    };

    ws.onerror = (error) => {
      console.error(`❌ WebSocket error: ${url}`, error);
      if (onError) onError(error);
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket closed: ${url}`);
      if (onClose) onClose(event);

      // Attempt reconnection if enabled
      if (reconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`🔄 Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
        setTimeout(connect, reconnectDelay);
      }
    };

    return ws;
  }

  return connect();
}

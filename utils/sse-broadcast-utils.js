/**
 * SSE (Server-Sent Events) Broadcast Utilities
 * Manages server-sent events for real-time updates to clients
 */

/**
 * SSE Client Manager
 * Manages a set of connected SSE clients
 */
export class SseClientManager {
  constructor() {
    this.clients = new Set();
  }

  /**
   * Add a new SSE client
   * @param {Object} client - Client object with send() method
   * @returns {void}
   */
  add(client) {
    this.clients.add(client);
    console.log(`✅ [SSE-ENDPOINT] Client added, total clients: ${this.clients.size}`);
  }

  /**
   * Remove an SSE client
   * @param {Object} client - Client object to remove
   * @returns {void}
   */
  remove(client) {
    this.clients.delete(client);
    console.log(`🔌 [SSE-ENDPOINT] Client disconnected, remaining clients: ${this.clients.size}`);
  }

  /**
   * Get the number of connected clients
   * @returns {number}
   */
  size() {
    return this.clients.size;
  }

  /**
   * Broadcast a message to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Data to broadcast
   * @returns {Object} Broadcast result with success/failure counts
   */
  broadcast(event, data) {
    const timestamp = new Date().toISOString();
    let successfulBroadcasts = 0;
    let failedBroadcasts = 0;

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📡 [SSE BROADCAST ${timestamp}]`);
    console.log(`   Client count: ${this.clients.size}`);
    console.log(`   Event: ${event}`);
    console.log(`${'─'.repeat(80)}`);

    for (const client of this.clients) {
      try {
        const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        client.send(eventData);
        successfulBroadcasts++;
        console.log(`✅ [SSE] Broadcast #${successfulBroadcasts} sent successfully`);
      } catch (error) {
        failedBroadcasts++;
        console.error(`❌ [SSE] Broadcast failed (#${failedBroadcasts}):`, error.message);
        console.error(`   Error details:`, error);
      }
    }

    console.log(`📊 [SSE] Broadcast summary: ${successfulBroadcasts} successful, ${failedBroadcasts} failed`);
    console.log(`${'─'.repeat(80)}\n`);

    return {
      successful: successfulBroadcasts,
      failed: failedBroadcasts,
      total: this.clients.size
    };
  }

  /**
   * Broadcast a transcript message
   * @param {Object} transcript - Transcript object
   * @returns {Object} Broadcast result
   */
  broadcastTranscript(transcript) {
    return this.broadcast('transcript', { content: transcript });
  }

  /**
   * Broadcast a progress update
   * @param {string} message - Progress message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Broadcast result
   */
  broadcastProgress(message, metadata = {}) {
    const progressData = {
      content: {
        user_id: 'zoom-ai',
        user_name: 'Zoom AI Assistant',
        data: message,
        timestamp: Date.now(),
        ...metadata
      }
    };

    return this.broadcast('progress', progressData);
  }

  /**
   * Clear all clients (for cleanup)
   * @returns {void}
   */
  clear() {
    this.clients.clear();
  }
}

/**
 * Create an SSE client wrapper
 * @param {ReadableStreamDefaultController} controller - Stream controller
 * @returns {Object} Client object with send() method
 */
export function createSseClient(controller) {
  const encoder = new TextEncoder();

  return {
    send(data) {
      controller.enqueue(encoder.encode(data));
    }
  };
}

/**
 * Helper function to broadcast progress updates to SSE clients
 * @param {string} message - Progress message
 * @param {string} type - Message type (default: 'progress')
 * @param {SseClientManager} clientManager - Client manager instance
 * @returns {void}
 */
export function broadcastProgress(message, type = 'progress', clientManager) {
  if (!clientManager) {
    console.warn('⚠️ No client manager provided for progress broadcast');
    return;
  }

  clientManager.broadcastProgress(message, { type });
}

/**
 * Create a Hono-compatible SSE route handler
 * @param {SseClientManager} clientManager - Client manager instance
 * @returns {Function} Route handler function
 */
export function createSseRouteHandler(clientManager) {
  return (c) => {
    console.log(`🔌 [SSE-ENDPOINT] New SSE client connecting`);
    let clientRef = null;

    const stream = new ReadableStream({
      start(controller) {
        clientRef = createSseClient(controller);
        clientManager.add(clientRef);
        clientRef.send(': connected\n\n');
        console.log(`📤 [SSE-ENDPOINT] Sent connection confirmation`);
      },
      cancel() {
        if (clientRef) {
          clientManager.remove(clientRef);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  };
}

/**
 * Create CORS headers for SSE endpoint
 * @returns {Object} CORS headers
 */
export function createSseCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

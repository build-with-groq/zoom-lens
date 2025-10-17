/**
 * WebSocket Utilities
 * Handles WebSocket connections for Zoom RTMS signaling and media
 */

import { generateSignature } from "./crypto-utils.js";
import { INSTANCE_ID, bc } from "./config.js";

// RTMS data structures
export const activeConnections = new Map();
export const sseClients = new Set();

// Store for recent transcripts
let recentTranscripts = [];

// Zoom may provide server_urls in multiple shapes; normalize to a single wss:// URL
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

// Robustly parse WebSocket event data (string | Blob | ArrayBuffer | Uint8Array)
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

// Function to add transcript to recent transcripts for polling
export function addToRecentTranscripts(transcript) {
  recentTranscripts.unshift(transcript);
  
  // Keep only last 50 transcripts to prevent memory issues
  if (recentTranscripts.length > 50) {
    recentTranscripts = recentTranscripts.slice(0, 50);
  }
}

// Get recent transcripts
export function getRecentTranscripts() {
  return recentTranscripts;
}

// WebSocket connection functions for RTMS
export async function connectToSignalingWebSocket(meetingUuid, streamId, serverUrl) {
  const ws = new WebSocket(serverUrl);

  // Store connection for cleanup later
  if (!activeConnections.has(meetingUuid)) {
    activeConnections.set(meetingUuid, {});
  }
  activeConnections.get(meetingUuid).signaling = ws;

  ws.onopen = async () => {
    console.log(`🔌 SIGNALING: WebSocket connection opened - meeting: ${meetingUuid.slice(0, 8)}..., stream: ${streamId}`);
    const signature = await generateSignature(meetingUuid, streamId);

    // Send handshake message to the signaling server
    const handshake = {
      msg_type: 1, // SIGNALING_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUuid,
      rtms_stream_id: streamId,
      sequence: Math.floor(Math.random() * 1e9),
      signature,
    };
    ws.send(JSON.stringify(handshake));
    console.log(`📤 SIGNALING: Sent handshake request`);
  };

  ws.onmessage = async (event) => {
    try {
      const msg = await parseWsJson(event.data);

      // Handle successful handshake response
      if (msg.msg_type === 2 && msg.status_code === 0) { // SIGNALING_HAND_SHAKE_RESP
        console.log(`✅ SIGNALING: Handshake successful - status: ${msg.status_code}`);
        const mediaUrl = msg.media_server?.server_urls?.all;
        if (mediaUrl) {
          console.log(`🎯 SIGNALING: Got media server URL, connecting to media WebSocket...`);
          connectToMediaWebSocket(mediaUrl, meetingUuid, streamId, ws);
        } else {
          console.warn(`⚠️ SIGNALING: No media URL in handshake response`);
        }
      }

      // Respond to keep-alive requests
      if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
        console.log(`🔄 SIGNALING: Received keep-alive request - timestamp: ${msg.timestamp}, meeting: ${meetingUuid.slice(0, 8)}...`);
        const keepAliveResponse = {
          msg_type: 13, // KEEP_ALIVE_RESP
          timestamp: msg.timestamp,
        };
        ws.send(JSON.stringify(keepAliveResponse));
        console.log(`✅ SIGNALING: Sent keep-alive response - timestamp: ${msg.timestamp}`);
      }
    } catch (error) {
      console.error('Error processing signaling message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('Signaling socket error:', error);
  };

  ws.onclose = (event) => {
    console.log(`❌ SIGNALING: WebSocket connection closed - code: ${event.code}, reason: ${event.reason || 'none'}, meeting: ${meetingUuid.slice(0, 8)}...`);
    if (activeConnections.has(meetingUuid)) {
      delete activeConnections.get(meetingUuid).signaling;
    }
  };
}

export async function connectToMediaWebSocket(mediaUrl, meetingUuid, streamId, signalingSocket) {
  const mediaWs = new WebSocket(mediaUrl);

  // Store connection for cleanup later
  if (activeConnections.has(meetingUuid)) {
    activeConnections.get(meetingUuid).media = mediaWs;
  }

  mediaWs.onopen = async () => {
    console.log(`🔌 MEDIA: WebSocket connection opened - meeting: ${meetingUuid.slice(0, 8)}..., stream: ${streamId}`);
    const signature = await generateSignature(meetingUuid, streamId);
    const handshake = {
      msg_type: 3, // DATA_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUuid,
      rtms_stream_id: streamId,
      signature,
      media_type: 8, // MEDIA_DATA_TRANSCRIPT (same as Node.js version)
      payload_encryption: false,
    };
    mediaWs.send(JSON.stringify(handshake));
    console.log(`📤 MEDIA: Sent handshake request - media_type: 8 (transcript)`);
  };

  mediaWs.onmessage = async (event) => {
    try {
      const msg = await parseWsJson(event.data);

      // Handle successful media handshake
      if (msg.msg_type === 4 && msg.status_code === 0) { // DATA_HAND_SHAKE_RESP
        console.log(`✅ MEDIA: Handshake successful - status: ${msg.status_code}, ready to receive transcripts`);
        signalingSocket.send(
          JSON.stringify({
            msg_type: 7, // CLIENT_READY_ACK
            rtms_stream_id: streamId,
          })
        );
        console.log(`📤 SIGNALING: Sent CLIENT_READY_ACK via signaling socket`);
      }

      // Respond to keep-alive requests
      if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
        console.log(`🔄 MEDIA: Received keep-alive request - timestamp: ${msg.timestamp}, meeting: ${meetingUuid.slice(0, 8)}..., stream: ${streamId}`);
        const keepAliveResponse = {
          msg_type: 13, // KEEP_ALIVE_RESP
          timestamp: msg.timestamp,
        };
        mediaWs.send(JSON.stringify(keepAliveResponse));
        console.log(`✅ MEDIA: Sent keep-alive response - timestamp: ${msg.timestamp}`);
      }

      // Handle transcript data
      if (msg.msg_type === 17 && msg.content && msg.content.data) {
        let { user_id, user_name, data, timestamp } = msg.content;
        console.log(`📝 [ZOOM-WS] Transcript received: ${user_name || 'unknown'} → "${data?.slice(0, 50)}${data?.length > 50 ? '...' : ''}"`);

        // Broadcast to SSE clients (local) and to other isolates via BroadcastChannel
        try {
          const payload = {
            msg_type: 17,
            content: { user_id, user_name, data, timestamp }
          };
          
          console.log(`📤 [ZOOM-WS] Broadcasting to ${sseClients.size} SSE client(s)`);
          console.log(`📤 [ZOOM-WS] Payload:`, JSON.stringify(payload));
          
          // Store for polling endpoint
          addToRecentTranscripts(payload.content);
          console.log(`💾 [ZOOM-WS] Stored in recent transcripts`);
          
          // Local SSE
          let broadcastCount = 0;
          for (const client of sseClients) {
            try {
              client.send('event: transcript\n' + 'data: ' + JSON.stringify(payload) + '\n\n');
              broadcastCount++;
              console.log(`✅ [ZOOM-WS] Sent to SSE client ${broadcastCount}`);
            } catch (clientError) {
              console.error(`❌ [ZOOM-WS] Failed to send to SSE client:`, clientError);
            }
          }
          console.log(`✅ [ZOOM-WS] Broadcast complete: ${broadcastCount}/${sseClients.size} clients`);
          
          // Cross-isolate relay
          if (bc) {
            bc.postMessage({ type: 'transcript', origin: INSTANCE_ID, payload });
            console.log(`📡 [ZOOM-WS] Sent via BroadcastChannel`);
          }
        } catch (e) {
          console.error(`❌ [ZOOM-WS] SSE broadcast error:`, e);
        }
      }

    } catch (error) {
      console.error('Error processing media message:', error);
      // suppress non-transcript noisy logs
    }
  };

  mediaWs.onerror = (error) => {
    console.error('Media socket error:', error);
  };

  mediaWs.onclose = (event) => {
    console.log(`❌ MEDIA: WebSocket connection closed - code: ${event.code}, reason: ${event.reason || 'none'}, meeting: ${meetingUuid.slice(0, 8)}...`);
    if (activeConnections.has(meetingUuid)) {
      delete activeConnections.get(meetingUuid).media;
    }
  };
}


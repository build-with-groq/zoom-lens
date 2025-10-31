/**
 * WebSocket Utilities
 * Handles WebSocket connections for Zoom RTMS signaling and media
 */

import { generateSignature } from "./crypto-utils.js";
import { INSTANCE_ID, bc } from "../../config.js";

// RTMS data structures
export const activeConnections = new Map();
export const sseClients = new Set();

// Import micStateMap from main.js (will be set after main.js loads)
// This allows websocket handler to check if mic is enabled
let micStateMap = null;
export function setMicStateMap(map) {
  micStateMap = map;
  console.log('✅ Mic state map injected into websocket utils');
}

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

  // Track last transcript time to detect Zoom idle timeout
  let lastTranscriptTime = Date.now();
  let transcriptCount = 0;
  let keepStreamAliveInterval = null;

  // CRITICAL: Send periodic pings to keep Zoom transcript stream alive
  // Without this, Zoom may suspend transcript delivery after ~5 minutes of silence
  const startKeepStreamAlive = () => {
    if (keepStreamAliveInterval) {
      clearInterval(keepStreamAliveInterval);
    }
    
    keepStreamAliveInterval = setInterval(() => {
      try {
        // Send a lightweight ping message to keep the stream active
        // This is different from the KEEP_ALIVE_REQ (msg_type 12) which Zoom sends to us
        // We're sending a custom ping to tell Zoom "we're still listening for transcripts"
        const ping = {
          msg_type: 999, // Custom ping (not a standard Zoom msg_type)
          timestamp: Date.now(),
          purpose: 'keep_transcript_stream_alive'
        };
        
        if (mediaWs && mediaWs.readyState === WebSocket.OPEN) {
          mediaWs.send(JSON.stringify(ping));
          console.log(`💓 MEDIA: Sent keep-stream-alive ping to prevent Zoom timeout`);
        } else {
          console.warn(`⚠️ MEDIA: Cannot send keep-alive ping - WebSocket not open (state: ${mediaWs?.readyState})`);
        }
      } catch (error) {
        console.error(`❌ MEDIA: Error sending keep-alive ping:`, error);
      }
    }, 60000); // Send every 60 seconds (1 minute)
    
    console.log(`💓 MEDIA: Started keep-stream-alive timer (60s interval)`);
  };

  mediaWs.onmessage = async (event) => {
    try {
      const msg = await parseWsJson(event.data);

      // Handle successful media handshake
      if (msg.msg_type === 4 && msg.status_code === 0) { // DATA_HAND_SHAKE_RESP
        console.log(`✅ MEDIA: Handshake successful - status: ${msg.status_code}, ready to receive transcripts`);
        console.log(`⏰ MEDIA: Starting transcript timeout tracking`);
        lastTranscriptTime = Date.now();
        transcriptCount = 0;
        
        // Start periodic pings to keep transcript stream alive
        startKeepStreamAlive();
        
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
        const timeSinceLastTranscript = Math.floor((Date.now() - lastTranscriptTime) / 1000);
        console.log(`🔄 MEDIA: Received keep-alive request - timestamp: ${msg.timestamp}, meeting: ${meetingUuid.slice(0, 8)}..., stream: ${streamId}`);
        
        // CRITICAL: Log if we haven't received transcripts in a while
        if (timeSinceLastTranscript > 120) { // 2 minutes
          console.warn(`⚠️ MEDIA: No transcripts received in ${timeSinceLastTranscript}s (total received: ${transcriptCount})`);
          console.warn(`   This may indicate Zoom has suspended transcript delivery due to inactivity`);
        }
        
        const keepAliveResponse = {
          msg_type: 13, // KEEP_ALIVE_RESP
          timestamp: msg.timestamp,
        };
        mediaWs.send(JSON.stringify(keepAliveResponse));
        console.log(`✅ MEDIA: Sent keep-alive response - timestamp: ${msg.timestamp}`);
      }

      // Handle transcript data
      if (msg.msg_type === 17 && msg.content && msg.content.data) {
        const now = Date.now();
        const timeSinceLastTranscript = transcriptCount === 0 ? 0 : Math.floor((now - lastTranscriptTime) / 1000);
        transcriptCount++;
        lastTranscriptTime = now;
        
        let { user_id, user_name, data, timestamp } = msg.content;
        console.log(`📝 [ZOOM-WS #${transcriptCount}] Transcript received: ${user_name || 'unknown'} → "${data?.slice(0, 50)}${data?.length > 50 ? '...' : ''}"`);
        console.log(`   Time: ${new Date().toISOString()} | Gap since last: ${timeSinceLastTranscript === 0 ? 'first' : timeSinceLastTranscript + 's'}`);

        // CRITICAL: Check if mic is enabled before broadcasting voice transcripts
        // This prevents voice from triggering AI when mic is OFF
        // Still allows typed messages (manual-user) to work
        const micEnabled = micStateMap ? (micStateMap.get(user_id) ?? micStateMap.get('global') ?? true) : true;
        
        if (!micEnabled) {
          console.log(`🔇 [ZOOM-WS] Mic OFF - Blocking voice transcript from: ${user_name || 'unknown'}`);
          console.log(`   Transcript: "${data?.slice(0, 50)}${data?.length > 50 ? '...' : ''}"`);
          console.log(`   This transcript will NOT be sent to frontend or trigger AI processing`);
          return; // Don't broadcast, don't store, don't process
        }

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
    // Clean up keep-alive timer on error
    if (keepStreamAliveInterval) {
      clearInterval(keepStreamAliveInterval);
      keepStreamAliveInterval = null;
      console.log(`💓 MEDIA: Stopped keep-stream-alive timer (error occurred)`);
    }
  };

  mediaWs.onclose = (event) => {
    console.log(`❌ MEDIA: WebSocket connection closed - code: ${event.code}, reason: ${event.reason || 'none'}, meeting: ${meetingUuid.slice(0, 8)}...`);
    
    // Clean up keep-alive timer on close
    if (keepStreamAliveInterval) {
      clearInterval(keepStreamAliveInterval);
      keepStreamAliveInterval = null;
      console.log(`💓 MEDIA: Stopped keep-stream-alive timer (connection closed)`);
    }
    
    if (activeConnections.has(meetingUuid)) {
      delete activeConnections.get(meetingUuid).media;
    }
  };
}


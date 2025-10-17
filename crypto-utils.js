/**
 * Cryptography Utilities
 * Helper functions for HMAC signatures and encryption
 */

import { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } from "./config.js";

// Deno crypto helper for HMAC
export async function createHmacSha256(key, data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBytes = encoder.encode(data);

  const keyImported = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', keyImported, dataBytes);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate signature for RTMS authentication
export async function generateSignature(meetingUuid, streamId) {
  const message = `${ZOOM_CLIENT_ID},${meetingUuid},${streamId}`;
  return await createHmacSha256(ZOOM_CLIENT_SECRET, message);
}


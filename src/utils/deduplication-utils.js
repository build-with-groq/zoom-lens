/**
 * Deduplication Utilities
 * Prevents duplicate requests from being processed simultaneously
 */

/**
 * Request deduplicator class
 * Tracks recent requests and prevents duplicates within a time window
 */
export class RequestDeduplicator {
  constructor(config = {}) {
    this.requests = new Map(); // key -> timestamp
    this.windowMs = config.windowMs || 3000; // Default 3 seconds
    this.cleanupIntervalMs = config.cleanupIntervalMs || 10000; // Default 10 seconds
    this.lastCleanup = Date.now();
  }

  /**
   * Check if a request is a duplicate
   * @param {string} key - Unique key for the request
   * @returns {boolean} True if duplicate
   */
  isDuplicate(key) {
    const now = Date.now();
    const lastRequestTime = this.requests.get(key);

    if (lastRequestTime && (now - lastRequestTime) < this.windowMs) {
      console.log(`   ⚠️ DUPLICATE REQUEST DETECTED - ignoring (last seen ${now - lastRequestTime}ms ago)`);
      console.log(`   Request key: ${key.substring(0, 50)}...`);
      return true;
    }

    return false;
  }

  /**
   * Track a new request
   * @param {string} key - Unique key for the request
   * @returns {void}
   */
  track(key) {
    const now = Date.now();
    this.requests.set(key, now);
    console.log(`   ✅ New request tracked (dedup key: ${key.substring(0, 50)}...)`);

    // Cleanup old entries periodically
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(now);
      this.lastCleanup = now;
    }
  }

  /**
   * Clean up old request entries
   * @param {number} now - Current timestamp
   * @returns {void}
   */
  cleanup(now = Date.now()) {
    for (const [key, time] of this.requests.entries()) {
      if (now - time > this.cleanupIntervalMs) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Clear all tracked requests
   * @returns {void}
   */
  clear() {
    this.requests.clear();
  }

  /**
   * Get the number of tracked requests
   * @returns {number}
   */
  size() {
    return this.requests.size;
  }
}

/**
 * Create a deduplication key from transcript and user name
 * @param {string} transcript - Transcript text
 * @param {string} userName - User name
 * @returns {string} Deduplication key
 */
export function createDeduplicationKey(transcript, userName) {
  return `${transcript.trim()}_${userName}`;
}

/**
 * Default deduplication configuration
 */
export const DEFAULT_DEDUP_CONFIG = {
  windowMs: 3000,           // 3 seconds dedup window
  cleanupIntervalMs: 10000  // Clean up every 10 seconds
};

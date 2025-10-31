/**
 * Discovery Cache and Queue Management Utilities
 *
 * Prevents Discovery Mode from repeatedly looking up the same information.
 * Tracks what's been discovered and what's currently being processed.
 *
 * Features:
 * - Cache recent discoveries (default: 30 minutes)
 * - Queue management to prevent duplicate concurrent searches
 * - Topic normalization for fuzzy matching
 * - Automatic cleanup of stale entries
 *
 * Usage:
 * ```javascript
 * import { DiscoveryManager } from './utils/discovery-cache-utils.js';
 *
 * const discoveryManager = new DiscoveryManager({
 *   cacheWindowMs: 30 * 60 * 1000, // 30 minutes
 *   similarityThreshold: 0.8
 * });
 *
 * // Check if topic was recently discovered
 * if (discoveryManager.wasRecentlyDiscovered('salesforce stock price')) {
 *   console.log('Already looked this up recently');
 * }
 *
 * // Add to queue before processing
 * const queueId = discoveryManager.addToQueue('salesforce stock price');
 *
 * // After discovery completes
 * discoveryManager.cacheDiscovery('salesforce stock price', result);
 * discoveryManager.removeFromQueue(queueId);
 * ```
 */

import { getDiscoveryStrategy } from './response-strategies.js';

/**
 * Normalize a topic string for comparison
 * - Lowercase
 * - Remove punctuation
 * - Trim whitespace
 * - Sort words (for better matching)
 */
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim()
    .split(/\s+/)
    .sort()
    .join(' ');
}

/**
 * Calculate similarity between two topics (0-1 scale)
 * Uses simple word overlap metric
 */
function calculateTopicSimilarity(topic1, topic2) {
  const words1 = new Set(normalizeTopic(topic1).split(' '));
  const words2 = new Set(normalizeTopic(topic2).split(' '));

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Discovery Manager
 * Manages cache and queue for discovery operations
 */
export class DiscoveryManager {
  /**
   * @param {Object} config - Configuration options
   * @param {number} config.cacheWindowMs - How long to keep discoveries cached (default: 30 minutes)
   * @param {number} config.similarityThreshold - Minimum similarity to consider topics duplicate (default: 0.8)
   * @param {boolean} config.enableLogging - Enable verbose logging (default: true)
   */
  constructor(config = {}) {
    this.cacheWindowMs = config.cacheWindowMs || 30 * 60 * 1000; // 30 minutes default
    this.similarityThreshold = config.similarityThreshold || 0.8;
    this.enableLogging = config.enableLogging !== false;

    // Cache: { topic: { timestamp, result, normalized } }
    this.cache = new Map();

    // Queue: { id: { topic, timestamp, normalized } }
    this.queue = new Map();

    // Counter for generating unique queue IDs
    this.queueIdCounter = 0;

    // Periodically clean up stale entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000); // Every minute

    if (this.enableLogging) {
      console.log('🧠 Discovery Manager initialized');
      console.log(`   Cache window: ${this.cacheWindowMs / 1000}s`);
      console.log(`   Similarity threshold: ${this.similarityThreshold}`);
    }
  }

  /**
   * Check if a topic was recently discovered
   * @param {string} topic - Topic to check
   * @returns {boolean} True if topic was recently discovered
   */
  wasRecentlyDiscovered(topic) {
    const normalized = normalizeTopic(topic);
    const now = Date.now();

    // Check cache for exact or similar matches
    for (const [cachedTopic, entry] of this.cache.entries()) {
      // Skip stale entries
      if (now - entry.timestamp > this.cacheWindowMs) {
        continue;
      }

      // Check similarity
      const similarity = calculateTopicSimilarity(normalized, entry.normalized);
      if (similarity >= this.similarityThreshold) {
        if (this.enableLogging) {
          console.log(`📋 Cache hit: "${topic}" matches "${cachedTopic}" (${(similarity * 100).toFixed(0)}% similar)`);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a topic is currently in the queue
   * @param {string} topic - Topic to check
   * @returns {boolean} True if topic is in queue
   */
  isInQueue(topic) {
    const normalized = normalizeTopic(topic);

    for (const [queueId, entry] of this.queue.entries()) {
      const similarity = calculateTopicSimilarity(normalized, entry.normalized);
      if (similarity >= this.similarityThreshold) {
        if (this.enableLogging) {
          console.log(`⏳ Queue hit: "${topic}" matches queued item "${entry.topic}" (${(similarity * 100).toFixed(0)}% similar)`);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a topic is either cached or queued
   * @param {string} topic - Topic to check
   * @returns {Object} { cached: boolean, queued: boolean, shouldSkip: boolean }
   */
  checkTopic(topic) {
    const cached = this.wasRecentlyDiscovered(topic);
    const queued = this.isInQueue(topic);

    return {
      cached,
      queued,
      shouldSkip: cached || queued
    };
  }

  /**
   * Add a topic to the processing queue
   * @param {string} topic - Topic being processed
   * @returns {string} Queue ID (use this to remove from queue later)
   */
  addToQueue(topic) {
    const queueId = `q_${++this.queueIdCounter}`;
    const normalized = normalizeTopic(topic);

    this.queue.set(queueId, {
      topic,
      normalized,
      timestamp: Date.now()
    });

    if (this.enableLogging) {
      console.log(`📥 Added to queue [${queueId}]: "${topic}"`);
      console.log(`   Queue size: ${this.queue.size}`);
    }

    return queueId;
  }

  /**
   * Remove a topic from the queue
   * @param {string} queueId - Queue ID returned from addToQueue
   */
  removeFromQueue(queueId) {
    const entry = this.queue.get(queueId);
    if (entry) {
      this.queue.delete(queueId);
      if (this.enableLogging) {
        console.log(`📤 Removed from queue [${queueId}]: "${entry.topic}"`);
        console.log(`   Queue size: ${this.queue.size}`);
      }
    }
  }

  /**
   * Cache a discovery result
   * @param {string} topic - Topic that was discovered
   * @param {*} result - Discovery result
   */
  cacheDiscovery(topic, result) {
    const normalized = normalizeTopic(topic);

    this.cache.set(topic, {
      topic,
      normalized,
      result,
      timestamp: Date.now()
    });

    if (this.enableLogging) {
      console.log(`💾 Cached discovery: "${topic}"`);
      console.log(`   Cache size: ${this.cache.size}`);
    }
  }

  /**
   * Get a cached discovery result
   * @param {string} topic - Topic to retrieve
   * @returns {*} Cached result or null if not found
   */
  getCachedDiscovery(topic) {
    const normalized = normalizeTopic(topic);
    const now = Date.now();

    for (const [cachedTopic, entry] of this.cache.entries()) {
      // Skip stale entries
      if (now - entry.timestamp > this.cacheWindowMs) {
        continue;
      }

      // Check similarity
      const similarity = calculateTopicSimilarity(normalized, entry.normalized);
      if (similarity >= this.similarityThreshold) {
        if (this.enableLogging) {
          console.log(`🔍 Retrieved cached: "${cachedTopic}" for query "${topic}"`);
        }
        return entry.result;
      }
    }

    return null;
  }

  /**
   * Get all current queue items
   * @returns {Array} Array of queue items
   */
  getQueueItems() {
    return Array.from(this.queue.values()).map(entry => ({
      topic: entry.topic,
      ageMs: Date.now() - entry.timestamp
    }));
  }

  /**
   * Get all cached items
   * @returns {Array} Array of cached items
   */
  getCachedItems() {
    const now = Date.now();
    return Array.from(this.cache.values())
      .filter(entry => now - entry.timestamp <= this.cacheWindowMs)
      .map(entry => ({
        topic: entry.topic,
        ageMs: now - entry.timestamp
      }));
  }

  /**
   * Get summary of cache and queue state
   * @returns {Object} Summary object
   */
  getSummary() {
    const queueItems = this.getQueueItems();
    const cachedItems = this.getCachedItems();

    return {
      cache: {
        count: cachedItems.length,
        items: cachedItems
      },
      queue: {
        count: queueItems.length,
        items: queueItems
      }
    };
  }

  /**
   * Clean up stale cache entries
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;

    // Clean cache
    for (const [topic, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheWindowMs) {
        this.cache.delete(topic);
        removedCount++;
      }
    }

    if (this.enableLogging && removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} stale cache entries`);
    }
  }

  /**
   * Clear all cache and queue
   */
  clear() {
    this.cache.clear();
    this.queue.clear();
    if (this.enableLogging) {
      console.log('🗑️ Cleared all cache and queue');
    }
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    if (this.enableLogging) {
      console.log('💥 Discovery Manager destroyed');
    }
  }
}

/**
 * Enhanced discovery filtering with cache awareness
 *
 * @param {Object} groqClient - Groq API client
 * @param {Object} config - Configuration
 * @param {string} config.transcript - User's message
 * @param {Array} config.chatHistory - Recent chat history
 * @param {DiscoveryManager} config.discoveryManager - Discovery manager instance
 * @param {string} config.strategy - Strategy ID ('everything', 'eager', 'reluctant', 'shy')
 * @param {string} config.model - Model to use
 * @returns {Promise<Object>} { should_discover: boolean, insights: Array, skipped: Array }
 */
export async function evaluateDiscoveryNeed(groqClient, config) {
  const {
    transcript,
    chatHistory = [],
    discoveryManager,
    strategy = 'reluctant',
    model = 'llama-3.3-70b-versatile'
  } = config;

  // Get the strategy configuration
  const strategyConfig = getDiscoveryStrategy(strategy);

  const today = new Date().toISOString().split('T')[0];

  // Build context from chat history
  // Use more messages (30 instead of 10) to give better conversation context
  const recentHistory = chatHistory.slice(-30); // Last 30 messages
  const historyContext = recentHistory.length > 0
    ? recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
    : 'No prior conversation';

  console.log(`📝 Using ${recentHistory.length} messages for discovery context`);

  // Get summary of what's cached and queued
  const summary = discoveryManager.getSummary();
  const cachedTopics = summary.cache.items.map(item => item.topic);
  const queuedTopics = summary.queue.items.map(item => item.topic);

  const discoveryPrompt = `You are a background research AI for Discovery Mode. Your job is to provide ENGAGING, VALUE-ADDING context that enriches conversations.

**Discovery Mode Purpose**: Add value to conversations by answering questions, providing relevant background, and surfacing interesting insights.

Recent conversation:
${historyContext}

Latest message: "${transcript}"

Already discovered (don't repeat these):
${cachedTopics.length > 0 ? cachedTopics.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(nothing yet)'}

Currently being researched (don't duplicate these):
${queuedTopics.length > 0 ? queuedTopics.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(nothing)'}

**Available Research Tools**:
- **Salesforce**: Use for business context (people, companies, deals, accounts)
- **Groq Compound** (Web Search): Use for current events, general knowledge, technical topics, news
- **Weather**: Use for location-based weather information

${strategyConfig.evaluationRules}

Today's date: ${today}

Respond with JSON:
{
  "should_discover": false,  // true if research would add value to the conversation
  "reasoning": "Brief explanation",
  "insights": [
    // Only include if should_discover is true, maximum ${strategyConfig.maxInsights} insight(s)
    {
      "topic": "What you're researching (be specific and conversation-relevant)",
      "tool": "salesforce|groq_compound|weather",  // Which tool to use
      "suggested_query": "Specific search query",
      "priority": "high|medium|low",
      "rationale": "Why this will make the conversation better or answer a question"
    }
  ]
}`;

  const response = await groqClient.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `${strategyConfig.systemPrompt} Today's date is ${today}.`
      },
      { role: "user", content: discoveryPrompt }
    ],
    temperature: strategyConfig.temperature,
    max_tokens: 2000
  });

  const content = response.choices[0]?.message?.content;

  // Parse response
  let decision;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      decision = JSON.parse(jsonMatch[0]);
    } else {
      decision = { should_discover: false, insights: [] };
    }
  } catch (parseError) {
    console.warn('⚠️ Failed to parse discovery decision:', parseError);
    decision = { should_discover: false, insights: [] };
  }

  // Double-check each insight against cache/queue
  const filteredInsights = [];
  const skippedInsights = [];

  if (decision.should_discover && decision.insights) {
    for (const insight of decision.insights) {
      const check = discoveryManager.checkTopic(insight.topic);

      if (check.shouldSkip) {
        console.log(`⏭️ Skipping "${insight.topic}" - ${check.cached ? 'cached' : 'queued'}`);
        skippedInsights.push({
          ...insight,
          reason: check.cached ? 'already_cached' : 'already_queued'
        });
      } else {
        filteredInsights.push(insight);
      }
    }
  }

  // Limit insights based on strategy max
  const limitedInsights = filteredInsights.slice(0, strategyConfig.maxInsights);

  return {
    should_discover: limitedInsights.length > 0,
    insights: limitedInsights,
    skipped: skippedInsights,
    reasoning: decision.reasoning
  };
}

/**
 * Helper to format cache/queue summary for display
 * @param {DiscoveryManager} discoveryManager - Discovery manager instance
 * @returns {string} Formatted summary
 */
export function formatDiscoverySummary(discoveryManager) {
  const summary = discoveryManager.getSummary();

  let output = '📊 Discovery Status:\n';

  // Cached items
  output += `\n💾 Cached (${summary.cache.count}):\n`;
  if (summary.cache.count === 0) {
    output += '   (nothing cached yet)\n';
  } else {
    summary.cache.items.forEach((item, i) => {
      const ageMinutes = Math.floor(item.ageMs / 60000);
      output += `   ${i + 1}. ${item.topic} (${ageMinutes}m ago)\n`;
    });
  }

  // Queued items
  output += `\n⏳ Queued (${summary.queue.count}):\n`;
  if (summary.queue.count === 0) {
    output += '   (nothing queued)\n';
  } else {
    summary.queue.items.forEach((item, i) => {
      const ageSeconds = Math.floor(item.ageMs / 1000);
      output += `   ${i + 1}. ${item.topic} (${ageSeconds}s ago)\n`;
    });
  }

  return output;
}

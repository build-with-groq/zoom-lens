/**
 * Hey Zoom Decision Utilities
 *
 * Selective decision-making for Hey Zoom triggers.
 * Determines whether the assistant should respond based on conversation context.
 *
 * Features:
 * - Cache-aware (won't respond to same query repeatedly)
 * - Context-aware (understands conversation flow)
 * - Very selective (defaults to NOT responding)
 * - Shows reasoning for decisions
 *
 * Usage:
 * ```javascript
 * import { evaluateResponseNeed, ActionFeedManager } from './utils/heyzoom-decision-utils.js';
 *
 * const decision = await evaluateResponseNeed(groqClient, {
 *   transcript: "hey zoom, what's the weather?",
 *   chatHistory: [...],
 *   responseManager,
 *   heyZoomEnabled: false  // false = use decision agent, true = always respond
 * });
 *
 * if (decision.shouldRespond) {
 *   // Process the request
 * } else {
 *   // Log decision to action feed
 * }
 * ```
 */

import { DiscoveryManager } from './discovery-cache-utils.js';
import { getHeyZoomStrategy } from './response-strategies.js';
import { getDirectives } from '../directives.js';

/**
 * Action Feed Manager
 * Manages action feed messages including router decisions
 */
export class ActionFeedManager {
  constructor(config = {}) {
    this.enableLogging = config.enableLogging !== false;
    this.messages = [];
    this.maxMessages = config.maxMessages || 100;
  }

  /**
   * Add a router decision to the action feed
   */
  addRouterDecision(decision) {
    const message = {
      type: 'router_decision',
      timestamp: Date.now(),
      shouldRespond: decision.shouldRespond,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      transcript: decision.transcript,
      cached: decision.cached,
      queued: decision.queued
    };

    this.messages.push(message);

    // Keep only recent messages
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    if (this.enableLogging) {
      const icon = decision.shouldRespond ? '✅' : '⏭️';
      console.log(`${icon} Router Decision: ${decision.shouldRespond ? 'RESPOND' : 'SKIP'}`);
      console.log(`   Reasoning: ${decision.reasoning}`);
      console.log(`   Confidence: ${decision.confidence}`);
    }

    return message;
  }

  /**
   * Get recent router decisions
   */
  getRecentDecisions(limit = 10) {
    return this.messages
      .filter(m => m.type === 'router_decision')
      .slice(-limit);
  }

  /**
   * Get all action feed messages
   */
  getAllMessages() {
    return this.messages;
  }

  /**
   * Clear action feed
   */
  clear() {
    this.messages = [];
    if (this.enableLogging) {
      console.log('🗑️ Action feed cleared');
    }
  }
}

/**
 * Evaluate whether Hey Zoom should respond to a message
 *
 * @param {Object} groqClient - Groq API client
 * @param {Object} config - Configuration
 * @param {string} config.transcript - User's message (with or without "hey zoom")
 * @param {Array} config.chatHistory - Recent chat history
 * @param {DiscoveryManager} config.responseManager - Response manager instance (reusing DiscoveryManager)
 * @param {boolean} config.heyZoomEnabled - Is Hey Zoom toggle ON? (true = always respond, false = use decision agent)
 * @param {string} config.strategy - Strategy ID ('everything', 'eager', 'reluctant', 'shy')
 * @param {string} config.model - Model to use for decision
 * @returns {Promise<Object>} { shouldRespond: boolean, reasoning: string, confidence: number, cached: boolean, queued: boolean }
 */
export async function evaluateResponseNeed(groqClient, config) {
  const {
    transcript,
    chatHistory = [],
    responseManager,
    heyZoomEnabled = false,
    strategy = 'reluctant',
    model = 'llama-3.3-70b-versatile'
  } = config;

  // Get the strategy configuration
  const strategyConfig = getHeyZoomStrategy(strategy);

  // Check for active directives - if in scribe/meeting mode, ALWAYS pass through to router
  // The router will decide whether to take notes only (empty tools array) or respond
  const directives = getDirectives('default');
  if (directives && directives.active) {
    // Check if directive indicates scribe/meeting mode
    const scribeModeKeywords = /\b(take notes?|note[\s-]?taking|scribe|meeting|conversation|sales? call|help take|record|document|capture)\b/i;
    if (scribeModeKeywords.test(directives.content)) {
      console.log('📋 DIRECTIVE DETECTED: Scribe/meeting mode - bypassing Hey Zoom decision agent');
      console.log(`   Directive: "${directives.content.substring(0, 80)}..."`);
      console.log('   → Passing to router to handle note-taking and selective responses');
      return {
        shouldRespond: true,
        reasoning: 'Active directive for note-taking/meeting mode - passing to router',
        confidence: 1.0,
        cached: false,
        queued: false,
        bypassedDecisionAgent: true,
        directiveMode: true
      };
    }
  }

  // If Hey Zoom is explicitly enabled (toggle ON), always respond
  if (heyZoomEnabled) {
    return {
      shouldRespond: true,
      reasoning: 'Hey Zoom toggle is ON - bypassing decision agent',
      confidence: 1.0,
      cached: false,
      queued: false,
      bypassedDecisionAgent: true
    };
  }

  // Check for incomplete sentences - if detected, ask frontend to wait longer
  const normalized = transcript.toLowerCase().replace(/hey zoom,?\s*/gi, '').trim();

  // Detect incomplete thoughts that suggest more speech is coming
  const incompletePatterns = [
    // Action verbs without objects
    /^(can you|could you|please|would you)\s*$/i,
    /^(look up|search for|find|tell me about|show me)\s*$/i,
    /^(what'?s?|where'?s?|when'?s?|who'?s?|how'?s?)\s*$/i,
    // Ends with prepositions or conjunctions (strong signal of incomplete thought)
    /\b(for|about|with|from|to|in|on|at|and|or|but|because)\s*$/i,
    // Starts action but no completion
    /^(can you|could you|please|would you)\s+(look|find|search|tell|show|get|create|make)\s*$/i,
    // Question words without completion
    /^(what|where|when|who|how|why)\s+(is|are|was|were|can|could|should|would|do|does|did)\s*$/i,
    // Very short messages (likely cut off)
    /^.{1,10}$/i,
  ];

  const seemsIncomplete = incompletePatterns.some(pattern => pattern.test(normalized));

  if (seemsIncomplete) {
    console.log('⏳ Incomplete sentence detected - requesting more wait time');
    return {
      shouldWait: true,
      waitSeconds: 2.5, // Wait an additional 2.5 seconds for more speech
      reasoning: 'Message appears incomplete - waiting for more speech',
      confidence: 0.9
    };
  }

  // Planning/creative keywords that indicate a NEW type of request (not a repeat)
  const planningKeywords = [
    /\bplan\b/i,
    /\bcreate\b/i,
    /\bwrite\b/i,
    /\bmake\s+(?:me\s+)?(?:a|an)\b/i,
    /\bdesign\b/i,
    /\bbuild\b/i,
    /\bitinerary\b/i,
    /\bschedule\b/i,
    /\borganize\b/i,
    /\bput\s+together\b/i,
    /\bcome\s+up\s+with\b/i,
    /\bthrow\s+(?:in|together)\b/i
  ];

  const isPlanningRequest = planningKeywords.some(pattern => pattern.test(normalized));

  // Keyword-based fallback for obvious requests (BEFORE cache check to bypass it)
  // This prevents AI models from being overly conservative on clear requests
  const obviousRequestPatterns = [
    /what'?s?\s+(?:the\s+)?weather/i,
    /weather\s+(?:in|at|for)/i,
    /(?:will|is|does)\s+it\s+(?:rain|snow|snowing|raining)/i,  // "will it rain", "is it raining", etc.
    /rain\s+(?:in|at|for)/i,  // "rain in [location]"
    /(?:rain|snow|forecast|temperature|sunny|cloudy|windy)\s+(?:in|at|for)\s+[A-Za-z]/i,  // Any weather term + location
    /search\s+(?:for|about)/i,
    /find\s+(?:me\s+)?(?:information|info|data|details)/i,
    /look\s+up/i,
    /can\s+you\s+(?:tell|show|find|search|get)/i,
    /(?:how\s+)?(?:do\s+i|to)\s+(?:find|search|get|look)/i,
    /salesforce/i,
    /crm/i,
    // Planning/creative requests (always respond to these)
    /\bplan\b/i,
    /\bcreate\b/i,
    /\bwrite\s+(?:me\s+)?(?:a|an)\b/i,
    /\bmake\s+(?:me\s+)?(?:a|an)\b/i,
    /\bdesign\b/i,
    /\bbuild\b/i,
    /\bitinerary\b/i,
  ];

  const hasObviousRequest = obviousRequestPatterns.some(pattern => pattern.test(normalized));

  // If it's an obvious request or planning request, bypass cache check and AI evaluation
  if (hasObviousRequest || isPlanningRequest) {
    console.log('🎯 Obvious request detected via keywords - bypassing cache check and conservative AI evaluation');
    return {
      shouldRespond: true,
      reasoning: isPlanningRequest
        ? 'Planning/creative request detected - always respond'
        : 'Clear request detected via keyword patterns',
      confidence: 0.95,
      cached: false,
      queued: false,
      bypassedDecisionAgent: true
    };
  }

  // Only do cache check if NOT a planning request and NOT an obvious request
  if (!isPlanningRequest && !hasObviousRequest) {
    const check = responseManager.checkTopic(normalized);

    if (check.shouldSkip) {
      return {
        shouldRespond: false,
        reasoning: check.cached
          ? `Already responded to similar query recently (cached)`
          : `Currently processing similar query (queued)`,
        confidence: 1.0,
        cached: check.cached,
        queued: check.queued
      };
    }
  }

  // Build context from chat history (increased from 10 to 30 for better continuity)
  const recentHistory = chatHistory.slice(-30);
  const historyContext = recentHistory.length > 0
    ? recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
    : 'No prior conversation';

  // Get summary of recent responses
  const summary = responseManager.getSummary();
  const recentResponses = summary.cache.items.map(item => item.topic);

  const evaluationPrompt = `You are an assistant decision agent. Your job is to decide if the assistant should respond to a message.

Recent conversation:
${historyContext}

Latest message: "${transcript}"

Recently responded to (don't repeat these):
${recentResponses.length > 0 ? recentResponses.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(no recent responses)'}

${strategyConfig.evaluationRules}

Respond with JSON:
{
  "should_respond": false,  // true or false based on the strategy rules
  "reasoning": "Brief explanation",
  "confidence": 0.95,  // 0-1 scale
  "category": "acknowledgment|casual|question|request|command"
}`;

  const response = await groqClient.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: strategyConfig.systemPrompt
      },
      { role: "user", content: evaluationPrompt }
    ],
    temperature: strategyConfig.temperature,
    max_tokens: 500
  });

  const content = response.choices[0]?.message?.content;

  // Parse response
  let decision;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      decision = JSON.parse(jsonMatch[0]);
    } else {
      decision = { should_respond: false, reasoning: 'Failed to parse decision', confidence: 0 };
    }
  } catch (parseError) {
    console.warn('⚠️ Failed to parse response decision:', parseError);
    decision = { should_respond: false, reasoning: 'Parse error', confidence: 0 };
  }

  return {
    shouldRespond: decision.should_respond || false,
    reasoning: decision.reasoning || 'No reasoning provided',
    confidence: decision.confidence || 0,
    category: decision.category || 'unknown',
    cached: false,
    queued: false
  };
}

/**
 * Format action feed message for display
 * @param {Object} message - Action feed message
 * @returns {string} Formatted message
 */
export function formatActionFeedMessage(message) {
  if (message.type !== 'router_decision') {
    return JSON.stringify(message);
  }

  const icon = message.shouldRespond ? '✅' : '⏭️';
  const status = message.shouldRespond ? 'RESPONDING' : 'SKIPPED';
  const cacheInfo = message.cached ? ' [CACHED]' : message.queued ? ' [QUEUED]' : '';

  return `${icon} ${status}${cacheInfo}: ${message.reasoning}`;
}

/**
 * Create a broadcast message for the action feed
 * Used to send router decisions to the frontend
 */
export function createActionFeedBroadcast(decision, transcript, userMessageTimestamp) {
  const icon = decision.shouldRespond ? '🤖' : '💭';
  const action = decision.shouldRespond ? 'Responding' : 'Skipping';

  // Use timestamp slightly after user message so it appears right after in chronological order
  // This ensures in newest-first view, the decision shows UNDER the AI response
  const decisionTimestamp = userMessageTimestamp ? userMessageTimestamp + 1 : Date.now();

  return {
    user_id: 'zoom-ai-router',
    user_name: 'Router Decision',
    data: `${icon} ${action}: ${decision.reasoning}`,
    timestamp: decisionTimestamp,
    type: 'router_decision',
    metadata: {
      shouldRespond: decision.shouldRespond,
      confidence: decision.confidence,
      cached: decision.cached,
      queued: decision.queued,
      transcript: transcript
    }
  };
}

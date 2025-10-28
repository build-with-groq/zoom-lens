/**
 * Agent-2 Configuration
 * Poke-inspired architecture with Interaction Agent (gatekeeper) + Execution Agent (worker)
 *
 * Key Principle: Separate "eager execution" from "thoughtful presentation"
 *
 * Problem being solved:
 * - Agent-1 is too "excited" to help - responds to everything
 * - Discovery mode triggers on every message
 * - No filtering between "should I do work?" and "should I respond?"
 *
 * Solution:
 * - Interaction Agent acts as gatekeeper/filter
 * - Execution Agent can be eager (it's okay!)
 * - Interaction Agent decides what reaches the user
 */

/**
 * Agent identity
 */
export const AGENT_CONFIG = {
  id: 'zoom-lens-agent-2',
  name: 'Zoom AI Assistant v2',
  displayName: 'Zoom AI',
  description: 'AI meeting assistant with Poke-inspired orchestration architecture',
  version: '2.0.0'
};

/**
 * Trigger configuration (same as agent-1)
 */
export const TRIGGER_CONFIG = {
  keywords: ['zoom'],
  greetings: ['hey', 'hi', 'hello', 'yo', 'sup', "what's up", 'greetings'],
  maxWordGap: 6,
  corrections: [
    { from: /\bzoom\b/g, to: 'Zoom' },
    { from: /\bZOOM\b/g, to: 'Zoom' },
    { from: /\bzooom\b/gi, to: 'Zoom' },
    { from: /\bzom\b/gi, to: 'Zoom' },
    { from: /hey\s+zoom/gi, to: 'Hey Zoom' },
    { from: /hi\s+zoom/gi, to: 'Hey Zoom' },
    { from: /hello\s+zoom/gi, to: 'Hey Zoom' },
    { from: /^\s*zoom\s+/gi, to: 'Zoom ' },
    { from: /\bhugging\s+clothes?\b/gi, to: 'Hugging Face' },
    { from: /\bhuging\s+face\b/gi, to: 'Hugging Face' },
    { from: /\bhuggingface\b/gi, to: 'Hugging Face' },
    { from: /\bhugging\s+face\b/gi, to: 'Hugging Face' },
  ]
};

/**
 * Interaction Agent Configuration (NEW!)
 * The gatekeeper that controls what reaches the user
 */
export const INTERACTION_AGENT_CONFIG = {
  model: 'llama-3.3-70b-versatile', // Fast model for filtering decisions

  // Personality: sharp, direct, not overly helpful
  personality: {
    tone: 'sharp, witty, direct',
    style: 'conversational, no corporate speak',
    principle: 'don\'t act like other sycophantic chatbots'
  },

  // Response filtering rules
  filtering: {
    // When to stay silent (invoke "wait" tool)
    waitConditions: [
      'User message is just acknowledgment (ok, thanks, got it)',
      'Response would be redundant with recent messages',
      'Tool output is irrelevant to current conversation',
      'Discovery findings are not actionable or interesting',
      'User is having side conversation with someone else'
    ],

    // When to respond
    respondConditions: [
      'Direct question or request',
      'Important information that requires action',
      'Clarification needed',
      'Significant discovery finding',
      'Error or issue that needs attention'
    ],

    // Tone down thresholds
    discoveryThreshold: {
      minImportance: 7, // 1-10 scale, only show discoveries rated 7+
      minActionable: 6,  // Only show if actionable score is 6+
      minNovel: 5        // Only show if novel/new information score is 5+
    }
  },

  // Context strategy for Interaction Agent
  contextStrategy: {
    messageLimit: 50, // More context for filtering decisions
    includeSystemMessages: false
  }
};

/**
 * Execution Agent Configuration (NEW!)
 * The worker that can be eager and thorough
 */
export const EXECUTION_AGENT_CONFIG = {
  model: 'openai/gpt-oss-120b', // Powerful model for execution

  // NO personality instructions - pure functional
  personality: null,

  // Execution style: thorough, eager is OK
  executionStyle: {
    thoroughness: 'high',
    toolUsage: 'liberal', // OK to call many tools
    creativity: 'medium'
  },

  // Context strategy for Execution Agent
  contextStrategy: {
    messageLimit: 20, // Less context needed for execution
    includeSystemMessages: false
  }
};

/**
 * Discovery Mode Configuration
 * Now filtered through Interaction Agent
 */
export const DISCOVERY_CONFIG = {
  enabled: true,

  // Discovery runs in background (via Execution Agent)
  backgroundInterval: 60000, // 1 minute

  // But Interaction Agent filters what shows up
  filteringEnabled: true,

  // Scoring thresholds (evaluated by Interaction Agent)
  thresholds: {
    importance: 7,   // 1-10, must be >= 7 to show
    actionable: 6,   // 1-10, must be >= 6 to show
    novelty: 5       // 1-10, must be >= 5 to show
  },

  // Rate limiting
  maxDiscoveriesPerHour: 3, // Don't overwhelm user
  minTimeBetweenDiscoveries: 300000 // 5 minutes minimum gap
};

/**
 * Router configuration (same as agent-1)
 */
export const ROUTER_CONFIG = {
  model: 'llama-3.3-70b-versatile',
  retryDelayMs: 3500,
  maxRetries: 1
};

/**
 * Response generation configuration
 */
export const RESPONSE_CONFIG = {
  defaultModel: 'openai/gpt-oss-120b',
  synthesisModel: 'llama-3.3-70b-versatile',
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000]
};

/**
 * Deduplication configuration
 */
export const DEDUP_CONFIG = {
  windowMs: 3000,
  cleanupIntervalMs: 10000
};

/**
 * Agent capabilities
 */
export const CAPABILITIES = {
  interactionFiltering: true,   // NEW: Gatekeeper filtering
  executionSeparation: true,    // NEW: Separate execution from presentation
  discoveryFiltering: true,     // NEW: Filter discovery outputs
  salesforceIntegration: true,
  webSearch: true,
  weatherInfo: true,
  mcpToolSupport: true,
  multiToolRequests: true,
  contextAwareness: true,
  progressBroadcast: true
};

/**
 * Agent-2 Specific Features
 */
export const AGENT2_FEATURES = {
  // Wait tool: Interaction Agent can stay silent
  waitTool: {
    enabled: true,
    description: 'Silently discard output without notifying user'
  },

  // Response evaluation: Before showing anything, evaluate it
  responseEvaluation: {
    enabled: true,
    evaluationPrompt: `
      Evaluate this response before showing to user:
      - Is it relevant to current conversation?
      - Is it redundant with recent messages?
      - Is it actionable or just noise?
      - Would user want to see this?

      Rate 1-10 on:
      - Relevance
      - Actionability
      - Novelty

      If scores are too low, invoke wait tool instead.
    `
  },

  // Discovery filtering
  discoveryFiltering: {
    enabled: true,
    filterPrompt: `
      Discovery findings from background analysis.

      Evaluate each finding:
      - Importance: How important is this? (1-10)
      - Actionable: Does this require action? (1-10)
      - Novel: Is this new information? (1-10)

      Only show findings where:
      - Importance >= 7
      - Actionable >= 6
      - Novel >= 5

      Otherwise invoke wait tool.
    `
  }
};

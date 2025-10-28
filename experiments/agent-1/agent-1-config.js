/**
 * Agent-1 Configuration
 * Configuration for the Zoom Lens AI Agent
 */

/**
 * Agent identity and branding
 */
export const AGENT_CONFIG = {
  id: 'zoom-lens-agent-1',
  name: 'Zoom AI Assistant',
  displayName: 'Zoom AI Assistant',
  description: 'AI-powered meeting assistant for Zoom with Salesforce integration',
  version: '1.0.0'
};

/**
 * Trigger configuration
 * Defines how the agent is triggered in conversations
 */
export const TRIGGER_CONFIG = {
  // Keywords that trigger the agent
  keywords: ['zoom'],

  // Greetings that can be used with keywords
  greetings: ['hey', 'hi', 'hello', 'yo', 'sup', "what's up", 'greetings'],

  // Maximum words allowed between greeting and keyword
  maxWordGap: 6,

  // Text corrections for common misspellings
  corrections: [
    // Zoom corrections
    { from: /\bzoom\b/g, to: 'Zoom' },
    { from: /\bZOOM\b/g, to: 'Zoom' },
    { from: /\bzooom\b/gi, to: 'Zoom' },
    { from: /\bzom\b/gi, to: 'Zoom' },
    { from: /hey\s+zoom/gi, to: 'Hey Zoom' },
    { from: /hi\s+zoom/gi, to: 'Hey Zoom' },
    { from: /hello\s+zoom/gi, to: 'Hey Zoom' },
    { from: /^\s*zoom\s+/gi, to: 'Zoom ' },

    // Hugging Face corrections
    { from: /\bhugging\s+clothes?\b/gi, to: 'Hugging Face' },
    { from: /\bhuging\s+face\b/gi, to: 'Hugging Face' },
    { from: /\bhuggingface\b/gi, to: 'Hugging Face' },
    { from: /\bhugging\s+face\b/gi, to: 'Hugging Face' },
  ]
};

/**
 * Context strategy configuration
 * Defines how chat history context is managed
 */
export const CONTEXT_CONFIG = {
  strategies: {
    MINIMAL: {
      messageLimit: 5,
      includeSystemMessages: false,
      description: 'MCP tool - using minimal context to avoid confusion'
    },
    FULL: {
      messageLimit: 30,
      includeSystemMessages: false,
      description: 'Conversational/follow-up - using full context to maintain thread'
    }
  },

  // Tool categories for context strategy selection
  mcpTools: ['salesforce', 'huggingface', 'parallel_search'],
  conversationalTools: ['direct_answer', 'groq_compound', 'weather']
};

/**
 * AI Router configuration
 * Settings for the intelligent routing system
 */
export const ROUTER_CONFIG = {
  model: 'llama-3.3-70b-versatile', // Fast routing model
  retryDelayMs: 3500, // Retry delay for race-based retry system
  maxRetries: 1
};

/**
 * Response generation configuration
 */
export const RESPONSE_CONFIG = {
  defaultModel: 'openai/gpt-oss-120b', // Main response generation model
  synthesisModel: 'llama-3.3-70b-versatile', // Multi-tool response synthesis model
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000] // Exponential backoff delays
};

/**
 * Deduplication configuration
 */
export const DEDUP_CONFIG = {
  windowMs: 3000, // 3 seconds dedup window
  cleanupIntervalMs: 10000 // Clean up every 10 seconds
};

/**
 * SSE configuration
 */
export const SSE_CONFIG = {
  enabled: true,
  corsEnabled: true
};

/**
 * Agent capabilities and features
 */
export const CAPABILITIES = {
  salesforceIntegration: true,
  webSearch: true,
  weatherInfo: true,
  mcpToolSupport: true,
  multiToolRequests: true,
  contextAwareness: true,
  progressBroadcast: true
};

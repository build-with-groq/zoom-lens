/**
 * Context Strategy Utilities
 * Manages chat history context based on tool types and conversation patterns
 */

/**
 * Default context strategies
 */
export const DEFAULT_CONTEXT_STRATEGIES = {
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
};

/**
 * Tool categories for context strategy selection
 */
export const TOOL_CATEGORIES = {
  MCP: ['salesforce', 'huggingface', 'parallel_search'],
  CONVERSATIONAL: ['direct_answer', 'groq_compound', 'weather']
};

/**
 * Patterns that indicate a follow-up question
 */
const FOLLOW_UP_PATTERNS = {
  // Questions that start with follow-up words
  startsWithFollowUp: /^(what about|tell me more|what's their|what is their|and what|how about|what if|why|how|explain|elaborate)/i,

  // Questions that contain references
  containsReference: /(this|that|these|those|it|they|them|their)\b/i
};

/**
 * Detect if a question is a follow-up to previous context
 * @param {string} text - Question text to analyze
 * @returns {boolean} True if follow-up question detected
 */
export function isFollowUpQuestion(text) {
  const trimmed = text.trim();
  return (
    FOLLOW_UP_PATTERNS.startsWithFollowUp.test(trimmed) ||
    FOLLOW_UP_PATTERNS.containsReference.test(trimmed)
  );
}

/**
 * Determine which tools are MCP tools
 * @param {string[]} tools - Array of tool names
 * @param {string[]} mcpToolList - List of MCP tool names
 * @returns {boolean} True if any MCP tools present
 */
export function hasMcpTools(tools, mcpToolList = TOOL_CATEGORIES.MCP) {
  return tools.some(tool => mcpToolList.includes(tool));
}

/**
 * Determine which tools are conversational tools
 * @param {string[]} tools - Array of tool names
 * @param {string[]} conversationalToolList - List of conversational tool names
 * @returns {boolean} True if any conversational tools present
 */
export function hasConversationalTools(tools, conversationalToolList = TOOL_CATEGORIES.CONVERSATIONAL) {
  return tools.some(tool => conversationalToolList.includes(tool));
}

/**
 * Select appropriate context strategy based on tools and question type
 * @param {string[]} tools - Array of tool names selected by router
 * @param {string} transcript - User's question/transcript
 * @param {Object} config - Configuration object
 * @param {string[]} config.mcpTools - List of MCP tool names
 * @param {string[]} config.conversationalTools - List of conversational tool names
 * @returns {Object} Context strategy with name and config
 */
export function selectContextStrategy(tools, transcript, config = {}) {
  const {
    mcpTools = TOOL_CATEGORIES.MCP,
    conversationalTools = TOOL_CATEGORIES.CONVERSATIONAL,
    strategies = DEFAULT_CONTEXT_STRATEGIES
  } = config;

  const hasMcp = hasMcpTools(tools, mcpTools);
  const isFollowUp = isFollowUpQuestion(transcript);

  // CRITICAL: MCP tools need MINIMAL context to avoid confusion
  // UNLESS it's a follow-up question (then use FULL context)
  // Conversational tools always use FULL context
  const strategyName = hasMcp && !isFollowUp ? 'MINIMAL' : 'FULL';
  const strategy = strategies[strategyName];

  console.log(`   Context Strategy: ${strategyName} (${strategy.description})`);

  return {
    name: strategyName,
    ...strategy,
    isFollowUp
  };
}

/**
 * Filter chat history based on context strategy
 * @param {Array} chatHistory - Full chat history array
 * @param {Object} strategy - Context strategy object
 * @param {string} currentQuery - Current user query (to exclude from history)
 * @returns {Array} Filtered chat history
 */
export function filterChatHistory(chatHistory, strategy, currentQuery = null) {
  if (!chatHistory || chatHistory.length === 0) {
    return [];
  }

  const {
    messageLimit = 30,
    includeSystemMessages = false
  } = strategy;

  return chatHistory
    .slice(0, messageLimit)
    .filter(msg => {
      // Filter out system messages if not included
      if (!includeSystemMessages) {
        if (msg.user_id === 'system' || msg.user_id === 'discovery-ai') {
          return false;
        }
      }

      // Filter out messages without data
      if (!msg.data) {
        return false;
      }

      // Filter out current query to avoid duplication
      if (currentQuery) {
        if (msg.data === currentQuery || msg.original_data === currentQuery) {
          return false;
        }
      }

      return true;
    });
}

/**
 * Get context limits for a specific strategy
 * @param {string} strategyName - Strategy name ('MINIMAL' or 'FULL')
 * @param {Object} strategies - Custom strategies object
 * @returns {number} Message limit
 */
export function getContextLimit(strategyName, strategies = DEFAULT_CONTEXT_STRATEGIES) {
  const strategy = strategies[strategyName];
  return strategy ? strategy.messageLimit : DEFAULT_CONTEXT_STRATEGIES.FULL.messageLimit;
}

/**
 * Format chat history for AI model consumption
 * @param {Array} chatHistory - Filtered chat history
 * @returns {string} Formatted history string
 */
export function formatChatHistoryForAI(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) {
    return 'No previous conversation history.';
  }

  return chatHistory
    .map(msg => `${msg.user_name || msg.user_id}: ${msg.data}`)
    .join('\n');
}

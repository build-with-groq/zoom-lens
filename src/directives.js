/**
 * Directives Management
 * Allows users and AI to set persistent directives that guide AI actions across all tools
 *
 * Examples:
 * - "All conversations should be in French"
 * - "Focus on Bob Jones from Salesforce for the following conversation"
 * - "Limit all web searches to Reddit"
 */

// In-memory storage for directives (per user session)
const directivesStorage = new Map();

/**
 * Set directives for AI operations
 * @param {string} userId - User identifier (default: 'default')
 * @param {string} content - Directive content
 * @returns {Object} - Success status and directive
 */
export function setDirectives(userId = 'default', content) {
  if (!content || typeof content !== 'string' || !content.trim()) {
    console.error('❌ Cannot set directives: content is required');
    return { success: false, error: 'Content is required' };
  }

  const directive = {
    content: content.trim(),
    timestamp: Date.now(),
    active: true
  };

  directivesStorage.set(userId, directive);

  console.log(`📋 Directives set for ${userId}:`, {
    content: directive.content.substring(0, 100) + (directive.content.length > 100 ? '...' : ''),
    timestamp: new Date(directive.timestamp).toISOString()
  });

  return { success: true, directive };
}

/**
 * Get the current directives for a user
 * @param {string} userId - User identifier
 * @returns {Object|null} - Current directives or null if none set
 */
export function getDirectives(userId = 'default') {
  const directive = directivesStorage.get(userId);

  if (!directive || !directive.active) {
    return null;
  }

  return directive;
}

/**
 * Clear directives for a user
 * @param {string} userId - User identifier
 * @returns {Object} - Success status
 */
export function clearDirectives(userId = 'default') {
  const directive = directivesStorage.get(userId);

  if (directive) {
    directive.active = false;
    console.log(`📋 Directives cleared for ${userId}`);
  }

  directivesStorage.delete(userId);
  return { success: true };
}

/**
 * Generate a system prompt addition for the directives
 * This gets injected into the AI's system prompt with high priority
 * @param {Object} directive - The directive object
 * @returns {string} - System prompt addition
 */
export function getDirectivesPrompt(directive) {
  if (!directive || !directive.active || !directive.content) {
    return '';
  }

  const prompt = `\n\n📋 **ACTIVE DIRECTIVES** (Priority: HIGH):
${directive.content}

⚠️ **CRITICAL**: These directives take precedence over general behavior. You MUST follow these directives for all subsequent actions and responses. If a directive conflicts with a user request, acknowledge the conflict and ask for clarification.`;

  return prompt;
}

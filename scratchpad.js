/**
 * Scratch Pad Management
 * Allows users and AI to maintain shared notes that provide context for conversations
 *
 * Examples:
 * - Meeting notes
 * - Project context
 * - Important facts to remember
 * - Conversation history notes
 */

// In-memory storage for scratch pads (per user session)
const scratchPadStorage = new Map();

/**
 * Set scratch pad content
 * @param {string} userId - User identifier (default: 'default')
 * @param {string} content - Scratch pad content
 * @returns {Object} - Success status and scratch pad
 */
export function setScratchPad(userId = 'default', content) {
  if (content === null || content === undefined) {
    console.error('❌ Cannot set scratch pad: content is required');
    return { success: false, error: 'Content is required' };
  }

  // Allow empty content (for clearing)
  const scratchPad = {
    content: typeof content === 'string' ? content.trim() : '',
    timestamp: Date.now(),
    active: true
  };

  scratchPadStorage.set(userId, scratchPad);

  console.log(`📝 Scratch pad updated for ${userId}:`, {
    length: scratchPad.content.length,
    preview: scratchPad.content.substring(0, 100) + (scratchPad.content.length > 100 ? '...' : ''),
    timestamp: new Date(scratchPad.timestamp).toISOString()
  });

  return { success: true, scratchPad };
}

/**
 * Get the current scratch pad for a user
 * @param {string} userId - User identifier
 * @returns {Object|null} - Current scratch pad or null if none set
 */
export function getScratchPad(userId = 'default') {
  const scratchPad = scratchPadStorage.get(userId);

  if (!scratchPad || !scratchPad.active) {
    return null;
  }

  return scratchPad;
}

/**
 * Clear scratch pad for a user
 * @param {string} userId - User identifier
 * @returns {Object} - Success status
 */
export function clearScratchPad(userId = 'default') {
  const scratchPad = scratchPadStorage.get(userId);

  if (scratchPad) {
    scratchPad.active = false;
    console.log(`📝 Scratch pad cleared for ${userId}`);
  }

  scratchPadStorage.delete(userId);
  return { success: true };
}

/**
 * Generate a system prompt addition for the scratch pad
 * This gets injected into the AI's system prompt as contextual notes
 * @param {Object} scratchPad - The scratch pad object
 * @returns {string} - System prompt addition
 */
export function getScratchPadPrompt(scratchPad) {
  if (!scratchPad || !scratchPad.active || !scratchPad.content) {
    return '';
  }

  const prompt = `\n\n📝 **SCRATCH PAD NOTES** (Context):
${scratchPad.content}

ℹ️  These are shared notes that provide context for the conversation. Reference them when relevant, but they are informational rather than directive.`;

  return prompt;
}

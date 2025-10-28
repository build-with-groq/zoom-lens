/**
 * Agent Router
 * System for managing experimental agents
 *
 * Currently active: agent-1 (production implementation)
 *
 * Usage:
 * 1. Set ACTIVE_AGENT environment variable: export ACTIVE_AGENT=agent-1
 * 2. Or change ACTIVE_AGENT in config below
 * 3. Import getActiveAgent() in main.js
 *
 * Future experiments can be added to AGENT_REGISTRY below
 */

// ============================================================================
// CONFIGURATION - Change this to swap agents!
// ============================================================================

/**
 * Active agent selection
 * Options: 'agent-1' (more can be added to registry below)
 *
 * Can be overridden by ACTIVE_AGENT environment variable
 */
export const ACTIVE_AGENT = Deno.env.get('ACTIVE_AGENT') || 'agent-1';

console.log(`\n${'='.repeat(80)}`);
console.log(`🤖 ACTIVE AGENT: ${ACTIVE_AGENT}`);
console.log(`${'='.repeat(80)}\n`);

// ============================================================================
// AGENT REGISTRY
// ============================================================================

/**
 * Agent configurations and metadata
 * Add new experimental agents here as you develop them
 */
export const AGENT_REGISTRY = {
  'agent-1': {
    name: 'Agent-1: Production Assistant',
    description: 'Current production implementation with intelligent routing, tool selection, and response filtering',
    modulePath: './experiments/agent-1/agent-1-inference.js',
    supportsFiltering: true,
    supportsOrchestration: true,
    supportsScratchpad: true,
    supportsDiscovery: true
  }
  // Add future experiments here:
  // 'agent-2': {
  //   name: 'Agent-2: Experimental Name',
  //   description: 'Description of what this agent does differently',
  //   modulePath: './experiments/agent-2/agent-2-inference.js',
  //   supportsFiltering: true,
  //   supportsOrchestration: false
  // }
};

// ============================================================================
// AGENT LOADER
// ============================================================================

/**
 * Get the active agent's inference module
 * @returns {Promise<Object>} Agent module with inference functions
 */
export async function getActiveAgent() {
  const agentConfig = AGENT_REGISTRY[ACTIVE_AGENT];

  if (!agentConfig) {
    console.error(`❌ Unknown agent: ${ACTIVE_AGENT}`);
    console.log(`Available agents: ${Object.keys(AGENT_REGISTRY).join(', ')}`);
    throw new Error(`Agent "${ACTIVE_AGENT}" not found in registry`);
  }

  console.log(`\n📦 Loading agent: ${agentConfig.name}`);
  console.log(`   Description: ${agentConfig.description}`);
  console.log(`   Module: ${agentConfig.modulePath}`);

  try {
    const agentModule = await import(agentConfig.modulePath);
    console.log(`✅ Agent loaded successfully\n`);

    return {
      ...agentModule,
      config: agentConfig,
      agentId: ACTIVE_AGENT
    };
  } catch (error) {
    console.error(`❌ Failed to load agent: ${error.message}`);
    throw error;
  }
}

/**
 * Check if active agent supports a feature
 * @param {string} feature - Feature name
 * @returns {boolean}
 */
export function supportsFeature(feature) {
  const agentConfig = AGENT_REGISTRY[ACTIVE_AGENT];
  return agentConfig?.[feature] || false;
}

/**
 * Get agent info for the current active agent
 * @returns {Object} Agent configuration
 */
export function getAgentInfo() {
  return {
    agentId: ACTIVE_AGENT,
    ...AGENT_REGISTRY[ACTIVE_AGENT]
  };
}

/**
 * List all available agents
 * @returns {Array} Array of agent IDs
 */
export function listAvailableAgents() {
  return Object.keys(AGENT_REGISTRY);
}

/**
 * Switch agent at runtime (useful for testing)
 * @param {string} agentId - Agent ID to switch to
 * @returns {Promise<Object>} New agent module
 */
export async function switchAgent(agentId) {
  if (!AGENT_REGISTRY[agentId]) {
    throw new Error(`Agent "${agentId}" not found. Available: ${listAvailableAgents().join(', ')}`);
  }

  console.log(`\n🔄 Switching from ${ACTIVE_AGENT} to ${agentId}...`);

  // Note: This doesn't change the ACTIVE_AGENT constant, just returns the new agent
  // For persistent switching, set ACTIVE_AGENT environment variable
  const agentConfig = AGENT_REGISTRY[agentId];
  const agentModule = await import(agentConfig.modulePath);

  console.log(`✅ Switched to ${agentConfig.name}\n`);

  return {
    ...agentModule,
    config: agentConfig,
    agentId: agentId
  };
}

// ============================================================================
// TESTING HELPERS
// ============================================================================

/**
 * Test all registered agents with the same input (useful for comparison)
 * @param {string} transcript - Test input
 * @param {string} userName - User name
 * @param {Array} chatHistory - Chat history
 * @returns {Promise<Object>} Results from all agents
 */
export async function testAllAgents(transcript, userName, chatHistory = []) {
  const agentIds = listAvailableAgents();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTING ALL AGENTS (${agentIds.length} total)`);
  console.log(`   Input: "${transcript}"`);
  console.log(`${'='.repeat(80)}\n`);

  const results = {};

  // Test each registered agent
  for (const agentId of agentIds) {
    try {
      console.log(`\n--- Testing ${agentId} ---`);
      const agent = await switchAgent(agentId);
      const result = await agent.performGroqInference(
        transcript,
        userName,
        { meeting: true },
        chatHistory,
        false
      );
      results[agentId] = {
        success: true,
        response: result.response,
        detected: result.detected,
        tools: result.tools
      };
      console.log(`✅ ${agentId} completed`);
    } catch (error) {
      console.error(`❌ ${agentId} failed:`, error.message);
      results[agentId] = {
        success: false,
        error: error.message
      };
    }
  }

  // Print comparison
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 COMPARISON RESULTS`);
  console.log(`${'='.repeat(80)}`);

  for (const agentId of agentIds) {
    const agentConfig = AGENT_REGISTRY[agentId];
    console.log(`\n🤖 ${agentConfig.name}:`);
    if (results[agentId].success) {
      console.log(`   Detected: ${results[agentId].detected}`);
      console.log(`   Tools: ${results[agentId].tools?.length || 0}`);
      console.log(`   Response: ${results[agentId].response?.substring(0, 100)}...`);
    } else {
      console.log(`   ❌ Error: ${results[agentId].error}`);
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);

  return results;
}

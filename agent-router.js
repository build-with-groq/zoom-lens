/**
 * Agent Router
 * Simple system for swapping between agent-1 and agent-2
 *
 * Usage:
 * 1. Set ACTIVE_AGENT environment variable: export ACTIVE_AGENT=agent-2
 * 2. Or change ACTIVE_AGENT in config below
 * 3. Import getActiveAgent() in main.js
 */

// ============================================================================
// CONFIGURATION - Change this to swap agents!
// ============================================================================

/**
 * Active agent selection
 * Options: 'agent-1' | 'agent-2'
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
 */
export const AGENT_REGISTRY = {
  'agent-1': {
    name: 'Agent-1: Always-On Assistant',
    description: 'Original implementation - responds to everything',
    modulePath: './experiments/agent-1/agent-1-inference.js',
    supportsFiltering: false,
    supportsOrchestration: false
  },
  'agent-2': {
    name: 'Agent-2: Thoughtful Assistant',
    description: 'Poke-inspired - filters responses, stays silent when appropriate',
    modulePath: './experiments/agent-2/agent-2-inference.js',
    supportsFiltering: true,
    supportsOrchestration: true
  }
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

    // Fallback to agent-1 if agent-2 fails
    if (ACTIVE_AGENT !== 'agent-1') {
      console.log(`⚠️ Falling back to agent-1...`);
      const fallbackModule = await import('./experiments/agent-1/agent-1-inference.js');
      return {
        ...fallbackModule,
        config: AGENT_REGISTRY['agent-1'],
        agentId: 'agent-1',
        fallback: true
      };
    }

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
 * Test both agents with the same input (useful for comparison)
 * @param {string} transcript - Test input
 * @param {string} userName - User name
 * @param {Array} chatHistory - Chat history
 * @returns {Promise<Object>} Results from both agents
 */
export async function testBothAgents(transcript, userName, chatHistory = []) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTING BOTH AGENTS`);
  console.log(`   Input: "${transcript}"`);
  console.log(`${'='.repeat(80)}\n`);

  const results = {};

  // Test agent-1
  try {
    console.log(`\n--- Testing Agent-1 ---`);
    const agent1 = await switchAgent('agent-1');
    const result1 = await agent1.performGroqInference(
      transcript,
      userName,
      { meeting: true },
      chatHistory,
      false
    );
    results['agent-1'] = {
      success: true,
      response: result1.response,
      detected: result1.detected,
      tools: result1.tools
    };
    console.log(`✅ Agent-1 completed`);
  } catch (error) {
    console.error(`❌ Agent-1 failed:`, error.message);
    results['agent-1'] = {
      success: false,
      error: error.message
    };
  }

  // Test agent-2 (if it exists)
  try {
    console.log(`\n--- Testing Agent-2 ---`);
    const agent2 = await switchAgent('agent-2');

    if (agent2.performGroqInference) {
      const result2 = await agent2.performGroqInference(
        transcript,
        userName,
        { meeting: true },
        chatHistory,
        false
      );
      results['agent-2'] = {
        success: true,
        response: result2.response,
        detected: result2.detected,
        tools: result2.tools,
        waited: result2.waited || false
      };
      console.log(`✅ Agent-2 completed`);
    } else {
      results['agent-2'] = {
        success: false,
        error: 'Agent-2 inference not yet implemented'
      };
    }
  } catch (error) {
    console.error(`❌ Agent-2 failed:`, error.message);
    results['agent-2'] = {
      success: false,
      error: error.message
    };
  }

  // Print comparison
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 COMPARISON RESULTS`);
  console.log(`${'='.repeat(80)}`);

  console.log(`\n🤖 Agent-1 (Always-On):`);
  if (results['agent-1'].success) {
    console.log(`   Detected: ${results['agent-1'].detected}`);
    console.log(`   Response: ${results['agent-1'].response?.substring(0, 100)}...`);
  } else {
    console.log(`   ❌ Error: ${results['agent-1'].error}`);
  }

  console.log(`\n🤖 Agent-2 (Thoughtful):`);
  if (results['agent-2'].success) {
    console.log(`   Detected: ${results['agent-2'].detected}`);
    console.log(`   Waited: ${results['agent-2'].waited || false}`);
    console.log(`   Response: ${results['agent-2'].response?.substring(0, 100)}...`);
  } else {
    console.log(`   ❌ Error: ${results['agent-2'].error}`);
  }

  console.log(`\n${'='.repeat(80)}\n`);

  return results;
}

/**
 * Example: main.js updated to use agent-router
 *
 * This shows the minimal changes needed to enable agent switching.
 * Copy the relevant sections to your actual main.js
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";

// ============================================================================
// CHANGE 1: Replace direct agent-1 import with router
// ============================================================================

// OLD (direct import):
// import {
//   intelligentRouter,
//   correctZoomSpelling,
//   detectZoomTrigger,
//   getWeather,
//   performWebSearch,
//   answerDirectly,
//   performGroqInference
// } from "./experiments/agent-1/agent-1-inference.js";

// NEW (via router):
import { getActiveAgent, getAgentInfo, testBothAgents } from './agent-router.js';

// Load active agent at startup
console.log('🚀 Loading active agent...');
const activeAgent = await getActiveAgent();

// Extract functions from active agent
const {
  intelligentRouter,
  correctZoomSpelling,
  detectZoomTrigger,
  getWeather,
  performWebSearch,
  answerDirectly,
  performGroqInference
} = activeAgent;

console.log(`✅ Active agent ready: ${activeAgent.agentId}\n`);

// ============================================================================
// CHANGE 2: Add agent info endpoint (optional, useful for debugging)
// ============================================================================

const app = new Hono();

// New endpoint to check which agent is active
app.get('/api/agent-info', (c) => {
  return c.json({
    active: getAgentInfo(),
    loadedAt: new Date().toISOString()
  });
});

// ============================================================================
// CHANGE 3: Add test endpoint for comparing agents (optional)
// ============================================================================

app.post('/api/test-agents', async (c) => {
  try {
    const { transcript, user_name, chat_history } = await c.req.json();

    console.log(`\n🧪 Testing both agents with input: "${transcript}"\n`);

    const results = await testBothAgents(transcript, user_name, chat_history || []);

    return c.json({
      success: true,
      input: transcript,
      results: results,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Test agents endpoint error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// ============================================================================
// EXISTING CODE: No changes needed!
// Your existing routes work as-is because we imported the functions above
// ============================================================================

app.post('/api/trigger-groq', async (c) => {
  try {
    const body = await c.req.json();
    const { transcript, user_name, context, chat_history } = body;

    // This uses whichever agent is active (agent-1 or agent-2)
    const result = await performGroqInference(
      transcript,
      user_name,
      context,
      chat_history,
      false
    );

    return c.json({
      success: true,
      detected: result.detected,
      response: result.response,
      agent_used: activeAgent.agentId  // NEW: Include which agent was used
    });
  } catch (error) {
    console.error('Groq inference endpoint error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// All your other existing routes work exactly the same!
// app.get('/health', ...)
// app.post('/webhook', ...)
// etc.

export default app;

/**
 * SUMMARY OF CHANGES:
 *
 * 1. Replace agent import with router: 3 lines
 *    - import { getActiveAgent } from './agent-router.js'
 *    - const activeAgent = await getActiveAgent()
 *    - const { functions... } = activeAgent
 *
 * 2. Add agent info endpoint: Optional, 5 lines
 *
 * 3. Add test endpoint: Optional, 15 lines
 *
 * 4. Existing routes: NO CHANGES NEEDED!
 *
 * Now you can switch agents by:
 * - export ACTIVE_AGENT=agent-2
 * - Or change line 15 in agent-router.js
 * - Restart the app
 */

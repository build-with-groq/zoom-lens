/**
 * Agent-2 Integration Example
 * Shows how to integrate the Poke-inspired orchestration architecture
 */

import { groqClient } from '../../config.js';
import {
  orchestrateInteraction,
  evaluateResponseNecessity,
  evaluateOutputRelevance,
  filterDiscoveries,
  applyPersonality
} from '../../utils/interaction-agent-utils.js';
import {
  INTERACTION_AGENT_CONFIG,
  EXECUTION_AGENT_CONFIG,
  DISCOVERY_CONFIG
} from './agent-2-config.js';

/**
 * Example 1: Basic orchestrated interaction
 */
export async function handleUserMessage(transcript, userName, chatHistory) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📥 Received message: "${transcript}"`);
  console.log(`${'='.repeat(80)}\n`);

  // Use full orchestration
  const result = await orchestrateInteraction(groqClient, {
    userMessage: transcript,
    recentMessages: chatHistory,

    // Define execution function (this is your Execution Agent)
    executionFunction: async () => {
      console.log(`🔧 EXECUTION AGENT: Processing request...`);

      // Here you'd call your existing performGroqInference or other logic
      // The Execution Agent can be thorough and eager - that's OK!
      const response = await yourExistingInferenceFunction(transcript, userName, chatHistory);

      return response;
    },

    filteringConfig: INTERACTION_AGENT_CONFIG.filtering,
    personalityConfig: INTERACTION_AGENT_CONFIG.personality
  });

  // Check if Interaction Agent decided to respond
  if (result === null) {
    console.log(`⏭️ INTERACTION AGENT: Decided to stay silent (WAIT)`);
    return null; // Don't send anything to user
  }

  console.log(`✅ INTERACTION AGENT: Sending response to user`);
  return result.response;
}

/**
 * Example 2: Manual orchestration (more control)
 */
export async function handleUserMessageManual(transcript, userName, chatHistory) {
  // Step 1: Should we respond at all?
  const responseDecision = await evaluateResponseNecessity(groqClient, {
    userMessage: transcript,
    recentMessages: chatHistory
  });

  if (!responseDecision.shouldRespond) {
    console.log(`⏭️ Not responding to: "${transcript}"`);
    return null;
  }

  // Step 2: Execute (Execution Agent)
  console.log(`🔧 Executing...`);
  const executionOutput = await yourExistingInferenceFunction(transcript, userName, chatHistory);

  // Step 3: Filter output
  const filterDecision = await evaluateOutputRelevance(groqClient, {
    executionOutput: executionOutput.response,
    originalQuery: transcript,
    recentMessages: chatHistory,
    thresholds: {
      relevance: 7,
      actionability: 6,
      novelty: 5
    }
  });

  if (!filterDecision.shouldShow) {
    console.log(`⏭️ Filtering out execution output`);
    return null;
  }

  // Step 4: Apply personality
  const finalResponse = await applyPersonality(groqClient, {
    rawResponse: filterDecision.suggestedResponse,
    personality: INTERACTION_AGENT_CONFIG.personality
  });

  return finalResponse;
}

/**
 * Example 3: Discovery mode with filtering
 */
export async function handleDiscoveryMode(chatHistory) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 DISCOVERY MODE: Running background analysis`);
  console.log(`${'='.repeat(80)}\n`);

  // Run discovery (can be eager and thorough)
  const discoveries = await yourExistingDiscoveryFunction(chatHistory);

  console.log(`📊 Discovery found ${discoveries.length} potential insights`);

  // Filter discoveries through Interaction Agent
  const filteredDiscoveries = await filterDiscoveries(groqClient, {
    discoveries: discoveries,
    recentMessages: chatHistory,
    thresholds: DISCOVERY_CONFIG.thresholds
  });

  console.log(`✅ After filtering: ${filteredDiscoveries.length} insights will be shown`);

  // Rate limiting
  if (filteredDiscoveries.length > DISCOVERY_CONFIG.maxDiscoveriesPerHour) {
    console.log(`⚠️ Rate limit: Only showing top ${DISCOVERY_CONFIG.maxDiscoveriesPerHour}`);
    return filteredDiscoveries.slice(0, DISCOVERY_CONFIG.maxDiscoveriesPerHour);
  }

  return filteredDiscoveries;
}

/**
 * Example 4: Integration with existing agent-1 code
 */
export async function wrapAgent1WithFiltering(transcript, userName, chatHistory) {
  // Import your existing agent-1 function
  const { performGroqInference } = await import('../agent-1/agent-1-inference.js');

  // Wrap it with Interaction Agent
  return await orchestrateInteraction(groqClient, {
    userMessage: transcript,
    recentMessages: chatHistory,

    executionFunction: async () => {
      // Just call agent-1's existing logic
      return await performGroqInference(
        transcript,
        userName,
        { meeting: true },
        chatHistory,
        false, // skipTriggerDetection
        null,  // progressCallback
        null   // requestHeaders
      );
    },

    filteringConfig: INTERACTION_AGENT_CONFIG.filtering,
    personalityConfig: INTERACTION_AGENT_CONFIG.personality
  });
}

/**
 * Example 5: Response necessity check only (lightweight)
 */
export async function shouldRespondToMessage(transcript, chatHistory) {
  // Quick check before doing any heavy work
  const decision = await evaluateResponseNecessity(groqClient, {
    userMessage: transcript,
    recentMessages: chatHistory
  });

  console.log(`Should respond: ${decision.shouldRespond}`);
  console.log(`Reasoning: ${decision.reasoning}`);
  console.log(`Confidence: ${decision.confidence}`);

  return decision.shouldRespond;
}

/**
 * Placeholder for your existing inference function
 * Replace with actual import from agent-1 or new implementation
 */
async function yourExistingInferenceFunction(transcript, userName, chatHistory) {
  // This would be your actual inference logic
  return {
    response: "This is a placeholder response",
    tools: [],
    detected: true
  };
}

/**
 * Placeholder for discovery function
 */
async function yourExistingDiscoveryFunction(chatHistory) {
  // This would be your actual discovery logic
  return [
    {
      id: 'disc-1',
      finding: 'User mentioned Bob 3 times - might be important contact',
      type: 'contact',
      confidence: 0.8
    },
    {
      id: 'disc-2',
      finding: 'Meeting scheduled for tomorrow at 2pm',
      type: 'calendar',
      confidence: 0.9
    }
  ];
}

// Usage in main.js:
/*
import { handleUserMessage } from './experiments/agent-2/INTEGRATION_EXAMPLE.js';

app.post('/api/trigger-groq', async (c) => {
  const { transcript, user_name, chat_history } = await c.req.json();

  // Use agent-2 with filtering
  const response = await handleUserMessage(transcript, user_name, chat_history);

  if (response === null) {
    // Interaction Agent decided to stay silent
    return c.json({
      success: true,
      detected: false,
      waited: true  // Indicate we chose to wait
    });
  }

  // Send filtered response
  return c.json({
    success: true,
    detected: true,
    response: response
  });
});
*/

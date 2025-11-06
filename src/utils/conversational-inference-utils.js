/**
 * Conversational Inference Utilities
 * Handles regular chat completions (non-MCP) using Groq API
 *
 * Use chat.completions.create for:
 * - Direct Q&A without tools
 * - Routing decisions
 * - Multi-turn conversations
 * - Response synthesis
 */

/**
 * Execute a conversational inference call (no tools)
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {string} config.model - Model to use
 * @param {Array} config.messages - Array of message objects
 * @param {Object} config.options - Additional options (temperature, max_tokens, etc.)
 * @returns {Promise<Object>} Response from Groq API
 */
export async function executeConversationalInference(groqClient, config) {
  const {
    model,
    messages,
    options = {}
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`💬 CONVERSATIONAL INFERENCE`);
  console.log(`   Model: ${model}`);
  console.log(`   Messages: ${messages.length}`);
  console.log(`${'='.repeat(80)}`);

  // Log messages (with truncation for long content)
  messages.forEach((msg, idx) => {
    const preview = msg.content.substring(0, 100);
    console.log(`   [${idx}] ${msg.role}: ${preview}${msg.content.length > 100 ? '...' : ''}`);
  });

  try {
    const response = await groqClient.chat.completions.create({
      model,
      messages,
      ...options
    });

    console.log(`✅ Conversational inference completed`);
    return response;

  } catch (error) {
    console.error(`❌ Conversational inference failed:`, error);
    throw error;
  }
}

/**
 * Execute routing inference with JSON output
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {string} config.model - Model to use (fast router model recommended)
 * @param {string} config.systemPrompt - System prompt for routing
 * @param {string} config.userQuery - User query to route
 * @param {Object} config.options - Additional options
 * @returns {Promise<Object>} Routing decision as JSON
 */
export async function executeRoutingInference(groqClient, config) {
  const {
    model,
    systemPrompt,
    userQuery,
    options = {}
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 ROUTING INFERENCE`);
  console.log(`   Model: ${model}`);
  console.log(`   Query: ${userQuery.substring(0, 100)}...`);
  console.log(`${'='.repeat(80)}`);

  try {
    const response = await groqClient.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userQuery
        }
      ],
      temperature: 0.1, // Low temperature for consistent routing
      max_tokens: 1000,
      response_format: { type: "json_object" }, // Force JSON response
      ...options
    });

    const content = response.choices[0]?.message?.content;
    const routingDecision = JSON.parse(content);

    console.log(`✅ Routing completed: ${routingDecision.tools?.join(', ')}`);
    return routingDecision;

  } catch (error) {
    console.error(`❌ Routing inference failed:`, error);
    throw error;
  }
}

/**
 * Execute routing with race-based retry (fires retry after delay, takes first response)
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {number} retryDelayMs - Delay before firing retry (default: 3500ms)
 * @returns {Promise<Object>} Routing decision
 */
export async function executeRoutingWithRace(groqClient, config, retryDelayMs = 3500) {
  console.log(`🏁 Starting race-based routing (retry after ${retryDelayMs}ms)...`);

  const createRouterRequest = () => executeRoutingInference(groqClient, config);

  // Start the first request
  const firstRequest = createRouterRequest();

  // Set up the retry request to fire after delay
  const retryRequest = new Promise((resolve) => {
    setTimeout(() => {
      console.log(`🔄 Firing retry request (original still pending)...`);
      resolve(createRouterRequest());
    }, retryDelayMs);
  });

  // Race the original and retry - whichever completes first wins
  try {
    const result = await Promise.race([
      firstRequest,
      retryRequest.then(r => r) // Flatten the nested promise
    ]);

    console.log(`✅ Router request completed (race winner)`);
    return result;

  } catch (error) {
    console.error(`❌ Both routing requests failed:`, error);
    throw error;
  }
}

/**
 * Execute direct answer inference (conversational response)
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {string} config.model - Model to use
 * @param {string} config.question - User question
 * @param {Array} config.chatHistory - Previous chat messages
 * @param {Object} config.context - Additional context
 * @returns {Promise<Object>} Answer response
 */
export async function executeDirectAnswer(groqClient, config) {
  const {
    model,
    question,
    chatHistory = [],
    context = {}
  } = config;

  // Build messages array
  const messages = [
    {
      role: "system",
      content: `You are Zoom, the Zoom AI Assistant - a helpful meeting assistant integrated into Zoom. Your name is Zoom. Provide clear, concise, and accurate responses. ${context.today ? `Today's date: ${context.today}` : ''}`
    }
  ];

  // Add chat history
  if (chatHistory.length > 0) {
    chatHistory.forEach(msg => {
      messages.push({
        role: msg.user_id === 'zoom-ai' ? 'assistant' : 'user',
        content: msg.data
      });
    });
  }

  // Add current question
  messages.push({
    role: "user",
    content: question
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`💬 DIRECT ANSWER`);
  console.log(`   Model: ${model}`);
  console.log(`   Question: ${question.substring(0, 100)}...`);
  console.log(`   Chat history: ${chatHistory.length} messages`);
  console.log(`${'='.repeat(80)}`);

  try {
    const response = await groqClient.chat.completions.create({
      model,
      messages
    });

    const answer = response.choices[0]?.message?.content;
    console.log(`✅ Direct answer completed: ${answer?.substring(0, 100)}...`);

    return {
      response: answer || "I couldn't generate a response right now.",
      tool: "direct_answer"
    };

  } catch (error) {
    console.error(`❌ Direct answer failed:`, error);
    return {
      response: "Sorry, I couldn't answer that question directly at the moment.",
      tool: "direct_answer",
      error: error.message
    };
  }
}

/**
 * Execute multi-tool response synthesis
 * Combines responses from multiple tools into a coherent answer
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {string} config.model - Model to use for synthesis
 * @param {string} config.originalQuery - Original user query
 * @param {Array} config.toolResults - Array of tool results
 * @param {Array} config.toolsUsed - Array of tool names used
 * @returns {Promise<Object>} Synthesized response
 */
export async function executeSynthesis(groqClient, config) {
  const {
    model,
    originalQuery,
    toolResults,
    toolsUsed
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 RESPONSE SYNTHESIS`);
  console.log(`   Model: ${model}`);
  console.log(`   Tools used: ${toolsUsed.join(', ')}`);
  console.log(`${'='.repeat(80)}`);

  // Build synthesis prompt
  const toolResultsText = toolResults.map((result, index) =>
    `Tool ${index + 1} (${result.tool}): ${result.response}`
  ).join('\n\n');

  const synthesisPrompt = `The user asked: "${originalQuery}"

I gathered information from multiple sources:

${toolResultsText}

Please provide a comprehensive, well-formatted response that synthesizes all this information for the user.`;

  try {
    const response = await groqClient.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are Zoom AI, a helpful meeting assistant. Synthesize information from multiple sources into a clear, cohesive response."
        },
        {
          role: "user",
          content: synthesisPrompt
        }
      ]
    });

    const synthesized = response.choices[0]?.message?.content;
    console.log(`✅ Synthesis completed`);

    return {
      response: synthesized || "I've gathered information from multiple sources but couldn't synthesize a response.",
      tool: "synthesis",
      toolsUsed
    };

  } catch (error) {
    console.error(`❌ Synthesis failed:`, error);
    // Fallback: just combine the responses with line breaks
    return {
      response: toolResults.map(r => r.response).join('\n\n'),
      tool: "synthesis_fallback",
      toolsUsed
    };
  }
}

/**
 * Execute weather query using compound model
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {string} location - Location for weather query
 * @returns {Promise<Object>} Weather response
 */
export async function executeWeatherQuery(groqClient, location) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🌤️ WEATHER QUERY`);
  console.log(`   Location: ${location}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const response = await groqClient.chat.completions.create({
      model: "groq/compound-mini",
      messages: [
        {
          role: "system",
          content: `You are Zoom AI, a helpful weather assistant. TODAY'S DATE: ${today}. Respond with a single short line.`
        },
        {
          role: "user",
          content: `What's the current weather in ${location}? Return ONLY a single sentence with temperature, conditions, and any relevant details. Keep it brief and conversational.`
        }
      ]
    });

    const answer = response.choices[0]?.message?.content;
    console.log(`✅ Weather query completed`);

    return {
      response: answer || "I couldn't get the weather information right now.",
      tool: "weather"
    };

  } catch (error) {
    console.error(`❌ Weather query failed:`, error);
    return {
      response: `I couldn't retrieve weather information for ${location} at the moment.`,
      tool: "weather",
      error: error.message
    };
  }
}

/**
 * Execute web search using compound model
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {string} query - Search query
 * @param {Object} context - Additional context (chat history, etc.)
 * @returns {Promise<Object>} Search response
 */
export async function executeWebSearch(groqClient, query, context = {}) {
  const { chatHistory = [] } = context;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 WEB SEARCH`);
  console.log(`   Query: ${query.substring(0, 100)}...`);
  console.log(`${'='.repeat(80)}`);

  // Build messages with history
  const messages = [
    {
      role: "system",
      content: "You are Zoom AI, a helpful search assistant with access to real-time information."
    }
  ];

  // Add recent chat history for context
  if (chatHistory.length > 0) {
    chatHistory.slice(0, 5).forEach(msg => {
      messages.push({
        role: msg.user_id === 'zoom-ai' ? 'assistant' : 'user',
        content: msg.data
      });
    });
  }

  messages.push({
    role: "user",
    content: query
  });

  try {
    const response = await groqClient.chat.completions.create({
      model: "groq/compound",
      messages,
      temperature: 0.7,
      max_tokens: 4096
    });

    const answer = response.choices[0]?.message?.content;
    console.log(`✅ Web search completed`);

    return {
      response: answer || "I couldn't process your search request right now.",
      tool: "groq_compound"
    };

  } catch (error) {
    console.error(`❌ Web search failed:`, error);

    // Retry with simplified prompt if error
    if (error.message?.includes('Tool choice is none')) {
      console.log('🔄 Retrying with simplified prompt');

      try {
        const retryResponse = await groqClient.chat.completions.create({
          model: "groq/compound",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: `Please answer this question: ${query}` }
          ]
        });

        return {
          response: retryResponse.choices[0]?.message?.content || "I couldn't process your request.",
          tool: "groq_compound",
          retried: true
        };
      } catch (retryError) {
        console.error('❌ Retry failed:', retryError);
      }
    }

    return {
      response: "I couldn't retrieve search results at the moment.",
      tool: "groq_compound",
      error: error.message
    };
  }
}

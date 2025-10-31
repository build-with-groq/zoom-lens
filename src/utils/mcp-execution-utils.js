/**
 * MCP (Model Context Protocol) Execution Utilities
 * Handles MCP tool calls using the Groq Responses API
 *
 * The Responses API (responses.create) is optimized for MCP tool calls
 * and is faster than the standard chat.completions.create for function calling
 */

/**
 * Execute an MCP tool call using the Groq Responses API
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {string} config.model - Model to use (e.g., "openai/gpt-oss-120b")
 * @param {string} config.input - User input/query
 * @param {Array} config.tools - Array of MCP tools
 * @param {Object} config.options - Additional options (temperature, max_tokens, etc.)
 * @returns {Promise<Object>} Response from Groq API
 */
export async function executeMcpToolCall(groqClient, config) {
  const {
    model,
    input,
    tools,
    options = {}
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔧 MCP TOOL CALL`);
  console.log(`   Model: ${model}`);
  console.log(`   Input: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`);
  console.log(`   Tools: ${tools.length} MCP tools`);
  console.log(`${'='.repeat(80)}`);

  // Log each tool
  tools.forEach((tool, idx) => {
    console.log(`   Tool ${idx + 1}: ${tool.server_label} (${tool.server_url})`);
  });

  try {
    // Use responses.create for MCP tool calls (faster and optimized)
    const response = await groqClient.responses.create({
      model,
      input,
      tools,
      ...options
    });

    console.log(`✅ MCP tool call completed successfully`);
    return response;

  } catch (error) {
    console.error(`❌ MCP tool call failed:`, error);
    throw error;
  }
}

/**
 * Execute multiple MCP tool calls with retry logic
 *
 * @param {Object} groqClient - OpenAI-compatible Groq client
 * @param {Object} config - Configuration object
 * @param {Object} retryConfig - Retry configuration
 * @param {number} retryConfig.maxRetries - Maximum number of retries (default: 3)
 * @param {Array<number>} retryConfig.retryDelays - Delay in ms for each retry (default: [1000, 2000, 4000])
 * @returns {Promise<Object>} Response from Groq API
 */
export async function executeMcpWithRetry(groqClient, config, retryConfig = {}) {
  const {
    maxRetries = 3,
    retryDelays = [1000, 2000, 4000]
  } = retryConfig;

  let lastError = null;
  const requestId = Math.random().toString(36).substring(7);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 MCP call attempt ${attempt + 1}/${maxRetries} (Request ID: ${requestId})`);

      const response = await executeMcpToolCall(groqClient, config);

      console.log(`✅ MCP call succeeded on attempt ${attempt + 1}`);
      return response;

    } catch (error) {
      lastError = error;
      console.error(`❌ MCP call failed on attempt ${attempt + 1}:`, error.message);

      // Check if it's a 500 error (retry) or other error (don't retry)
      const is500Error = error.status === 500 || error.message?.includes('500');

      if (is500Error && attempt < maxRetries - 1) {
        const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
        console.log(`   ⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Don't retry for non-500 errors or if this was the last attempt
        break;
      }
    }
  }

  // If we got here, all retries failed
  console.error(`❌ All ${maxRetries} MCP call attempts failed`);
  throw lastError;
}

/**
 * Prepare MCP tools array from tool configurations
 *
 * @param {Array} selectedTools - Array of tool names selected by router
 * @param {Object} toolRegistry - Tool registry with tool configs
 * @param {Object} authHeaders - Authentication headers for each tool
 * @returns {Array} Array of MCP tools formatted for Groq API
 */
export function prepareMcpTools(selectedTools, toolRegistry, authHeaders = {}) {
  const mcpTools = [];

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔧 PREPARING MCP TOOLS`);
  console.log(`   Selected tools: ${selectedTools.length}`);
  console.log(`${'='.repeat(80)}`);

  for (const toolName of selectedTools) {
    const toolConfig = toolRegistry[toolName];

    if (!toolConfig) {
      console.warn(`   ⚠️ Tool not found in registry: ${toolName}`);
      continue;
    }

    // Only process MCP tools
    if (toolConfig.type !== 'mcp') {
      console.log(`   ⏭️ Skipping non-MCP tool: ${toolName}`);
      continue;
    }

    // Build MCP tool object
    const mcpTool = {
      type: 'mcp',
      server_label: toolConfig.server_label || toolName,
      server_url: toolConfig.server_url
    };

    // Add headers if provided for this tool
    if (authHeaders[toolName]) {
      mcpTool.headers = authHeaders[toolName];
    }

    // Add require_approval if specified
    if (toolConfig.require_approval) {
      mcpTool.require_approval = toolConfig.require_approval;
    }

    // Add allowed_tools if specified
    if (toolConfig.allowed_tools) {
      mcpTool.allowed_tools = toolConfig.allowed_tools;
    }

    mcpTools.push(mcpTool);
    console.log(`   ✅ Added MCP tool: ${toolConfig.displayName || toolName}`);
  }

  console.log(`${'='.repeat(80)}\n`);
  return mcpTools;
}

/**
 * Process MCP response and extract tool calls
 *
 * @param {Object} response - Response from Groq Responses API
 * @returns {Object} Processed response with extracted information
 */
export function processMcpResponse(response) {
  const result = {
    content: null,
    toolCalls: [],
    reasoning: null
  };

  // Extract content from response
  if (response.choices && response.choices[0]) {
    const choice = response.choices[0];
    result.content = choice.message?.content || null;

    // Extract tool calls if present
    if (choice.message?.tool_calls) {
      result.toolCalls = choice.message.tool_calls;
    }

    // Extract reasoning if available
    if (choice.message?.reasoning) {
      result.reasoning = choice.message.reasoning;
    }
  }

  return result;
}

/**
 * Deduplicate tool calls (sometimes models call the same tool multiple times)
 *
 * @param {Array} toolCalls - Array of tool call objects
 * @returns {Array} Deduplicated array of tool calls
 */
export function deduplicateToolCalls(toolCalls) {
  if (!toolCalls || toolCalls.length === 0) return [];

  const seen = new Set();
  const unique = [];

  for (const call of toolCalls) {
    // Create a key based on tool name and arguments
    const key = `${call.function?.name}-${JSON.stringify(call.function?.arguments)}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(call);
    } else {
      console.log(`   🔄 Deduplicated duplicate tool call: ${call.function?.name}`);
    }
  }

  if (unique.length < toolCalls.length) {
    console.log(`   📊 Deduplication: ${toolCalls.length} → ${unique.length} tool calls`);
  }

  return unique;
}

/**
 * Build MCP request with credentials
 *
 * @param {string} input - User input
 * @param {Object} credentials - Credentials object (e.g., Salesforce access token)
 * @param {Object} focusGoal - Current focus goal (optional)
 * @returns {string} Enhanced input with credentials context
 */
export function buildMcpInput(input, credentials = null, focusGoal = null) {
  let enhancedInput = input;

  // Add credentials context if provided
  if (credentials) {
    // Don't add actual credentials to input, they should be in headers
    // But can add context about authentication status
    enhancedInput = `[Authenticated user request]\n${enhancedInput}`;
  }

  // Add focus goal context if provided
  if (focusGoal) {
    enhancedInput = `[Current focus: ${focusGoal.description}]\n${enhancedInput}`;
  }

  return enhancedInput;
}

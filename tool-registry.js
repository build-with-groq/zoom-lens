/**
 * TOOL REGISTRY
 * 
 * Single source of truth for all tools (MCP and built-in)
 * This module exports tool configurations and helper functions
 */

// Unified Tool Registry - Single source of truth for all tools
export const UNIFIED_TOOL_REGISTRY = {
  // MCP Tools
  huggingface: {
    id: 'huggingface',
    type: 'mcp',
    category: 'ai_ml',
    namespace: 'huggingface',
    displayName: '🤗 HuggingFace',
    description: 'Hugging Face model and dataset search and management',
    routing_keywords: ['model', 'hugging face', 'dataset', 'machine learning', 'ai model', 'transform', 'nlp', 'computer vision'],
    trigger_prompt: 'Use this when users ask about AI models, datasets, machine learning models, transformers, NLP models, or want to find pretrained models. This tool can search models, get model details, and browse trending models on Hugging Face.',
    server_label: 'Huggingface',
    server_url: 'https://huggingface.co/mcp',
    headers: {},
    require_approval: 'always',
    allowed_tools: null,
    mcp_functions: [
      { name: 'search_models', description: 'Search for models by keyword, task, or name', params: ['query', 'task', 'sort', 'limit'] },
      { name: 'get_model_info', description: 'Get detailed information about a specific model', params: ['model_id'] },
      { name: 'search_datasets', description: 'Search for datasets by keyword or task', params: ['query', 'task', 'limit'] },
      { name: 'list_trending', description: 'Get trending models', params: ['limit'] }
    ],
    auth: { type: 'none' },
    examples: ['find a text generation model', 'search for image classification datasets', 'what are trending models']
  },

  parallel_search: {
    id: 'parallel_search',
    type: 'mcp',
    category: 'search',
    namespace: 'parallel',
    displayName: '🔍 Parallel Search',
    description: 'Advanced web search and content retrieval with Parallel',
    routing_keywords: ['search', 'find', 'look up', 'current', 'latest', 'news', 'trending', 'web'],
    trigger_prompt: 'Use this when users need real-time web information, want to search the internet, need current news, or want to look up trending topics. This tool performs web searches and retrieves page content.',
    server_label: 'ParallelSearch',
    server_url: 'https://mcp.parallel.ai/v1beta/search_mcp/',
    require_approval: 'never',
    allowed_tools: ['web_search', 'get_page_content', 'search_trending'],
    mcp_functions: [
      { name: 'web_search', description: 'Search the web for information', params: ['query', 'num_results'] },
      { name: 'get_page_content', description: 'Get content from a specific URL', params: ['url'] },
      { name: 'search_trending', description: 'Get trending topics', params: ['category'] }
    ],
    auth: { type: 'env_header', header: 'x-api-key', env: 'PARALLEL_API_KEY' },
    examples: ['search for latest AI news', 'find information about quantum computing', 'what\'s trending on social media']
  },

  salesforce: {
    id: 'salesforce',
    type: 'mcp',
    category: 'crm',
    namespace: 'salesforce',
    displayName: '☁️ Salesforce',
    description: 'Complete Salesforce CRM integration - handles ALL sales operations including leads, contacts, accounts, opportunities, tasks, notes, and SOQL queries. This MCP server provides 30+ functions for comprehensive CRM management.',
    routing_keywords: ['salesforce', 'crm', 'lead', 'leads', 'contact', 'contacts', 'account', 'accounts', 'opportunity', 'opportunities', 'soql', 'query', 'sales', 'SELECT', 'FROM', 'WHERE', 'LIMIT', 'task', 'note', 'convert', 'pipeline', 'deal', 'prospect', 'customer'],
    trigger_prompt: 'Use this for ANY sales or CRM-related requests. This tool handles: 1) Lead management (create/search/update/convert leads), 2) Account management (companies), 3) Contact management (people), 4) Opportunity management (deals/pipeline), 5) Task management (follow-ups), 6) Note management (conversation logs), 7) SOQL queries (any SELECT query), 8) General record operations (get/update any record type). If the user mentions anything sales-related, CRM data, or Salesforce operations, use this tool. The MCP server will intelligently select the right function from 30+ available operations.',
    server_label: 'Salesforce',
    server_url: '', // Will be set dynamically
    require_approval: 'never',
    allowed_tools: null,
    mcp_functions: [
      // Most commonly used functions - router can suggest these
      { name: 'sf_run_soql_query', description: 'Execute any SOQL query (SELECT queries). Use for complex searches, reporting, or when other functions don\'t fit', params: ['query'] },
      { name: 'sf_search_leads', description: 'Search leads by company, email, status, etc. Use for "get leads", "show leads", "find leads"', params: ['company', 'name', 'email', 'status', 'limit'] },
      { name: 'sf_create_lead', description: 'Create a new lead (prospect)', params: ['first_name', 'last_name', 'company', 'email', 'phone', 'status'] },
      { name: 'sf_search_accounts', description: 'Search accounts (companies) by name, industry, type', params: ['name', 'industry', 'type', 'limit'] },
      { name: 'sf_create_account', description: 'Create a new account (company)', params: ['name', 'industry', 'type', 'phone', 'website'] },
      { name: 'sf_search_contacts', description: 'Search contacts (people) by email, name, phone', params: ['email', 'last_name', 'phone', 'account_id', 'limit'] },
      { name: 'sf_create_contact', description: 'Create a new contact (person)', params: ['first_name', 'last_name', 'email', 'phone', 'account_id'] },
      { name: 'sf_search_opportunities', description: 'Search opportunities (deals) by stage, amount, name', params: ['stage', 'name', 'account_id', 'amount_min', 'limit'] },
      { name: 'sf_create_opportunity', description: 'Create a new opportunity (deal)', params: ['name', 'account_id', 'stage', 'amount', 'close_date'] },
      { name: 'sf_create_task', description: 'Create a task (follow-up, call, email)', params: ['subject', 'status', 'priority', 'related_to_id', 'due_date'] },
      { name: 'sf_create_note', description: 'Add a note to any record (lead, contact, account, etc.)', params: ['parent_id', 'title', 'body'] },
      { name: 'sf_get_record', description: 'Get any record by ID with optional field selection', params: ['sobject_type', 'record_id', 'fields'] },
      { name: 'sf_update_record', description: 'Update any record type (generic update function)', params: ['sobject_type', 'record_id', 'fields'] },
      // Note: The MCP server has 30+ functions total. These are just the most common ones.
    ],
    auth: { type: 'salesforce_session' },
    examples: [
      'search for leads in Acme Corp', 
      'create a new lead for John Doe', 
      'run SOQL query SELECT Id, Name FROM Lead LIMIT 10', 
      'get the latest leads', 
      'show me salesforce accounts',
      'create a new opportunity',
      'add a note to this contact',
      'update the lead status',
      'search for opportunities in pipeline',
      'create a follow-up task'
    ]
  },

  // Built-in Tools (handlers will be set in main.js)
  weather: {
    id: 'weather',
    type: 'builtin',
    category: 'utility',
    namespace: 'general',
    displayName: '🌤️ Weather',
    description: 'Weather information using Groq compound model',
    routing_keywords: ['weather', 'temperature', 'forecast', 'climate', 'rain', 'sunny', 'cloudy', 'humidity', 'wind'],
    trigger_prompt: 'Use this when users ask about weather, temperature, forecast, or climate conditions in any location.',
    handler: null, // Will be set in main.js
    examples: ['what\'s the weather in SF', 'forecast for tomorrow', 'is it raining']
  },

  groq_compound: {
    id: 'groq_compound',
    type: 'builtin',
    category: 'search',
    namespace: 'general',
    displayName: '⚡ Groq Compound',
    description: 'FAST lightweight web search and code execution using Groq compound model. Instantly searches the web for any query AND can run code for math calculations, data analysis, or code execution. Much faster than parallel_search.',
    routing_keywords: ['search', 'find', 'look up', 'current', 'latest', 'news', 'trending', 'web', 'information about', 'calculate', 'math', 'run code', 'execute', 'compute'],
    trigger_prompt: 'Use this when users need: 1) Current/real-time web information, latest news, or web searches, OR 2) Math calculations, code execution, or computational tasks. This is MUCH FASTER than parallel_search and should be PREFERRED for quick web searches and calculations.',
    handler: null, // Will be set in main.js
    examples: ['search for latest AI news', 'find information about quantum computing', 'calculate 15% of 2847', 'run this python code', 'what\'s the latest on OpenAI']
  },

  direct_answer: {
    id: 'direct_answer',
    type: 'builtin',
    category: 'general',
    namespace: 'general',
    displayName: '💭 Direct Answer',
    description: 'Direct answer using Groq compound model',
    routing_keywords: ['explain', 'what is', 'how does', 'why', 'when', 'where', 'who'],
    trigger_prompt: 'Use this as a fallback when no other tools match, or when users ask general knowledge questions that don\'t require real-time data or external tools.',
    handler: null, // Will be set in main.js
    examples: ['explain machine learning', 'what is quantum computing', 'how does the internet work']
  }
};

// Function to add tools programmatically to the unified registry
export function addTool(toolId, config) {
  UNIFIED_TOOL_REGISTRY[toolId] = {
    id: toolId,
    type: config.type || 'builtin',
    category: config.category || 'general',
    namespace: config.namespace || 'general',
    displayName: config.displayName || `⚙️ ${toolId}`,
    description: config.description || `${toolId} tool`,
    routing_keywords: config.routing_keywords || [],
    examples: config.examples || [],

    // MCP-specific fields
    ...(config.type === 'mcp' && {
      server_label: config.serverLabel || toolId,
      server_url: config.serverUrl,
      headers: config.headers || {},
      require_approval: config.requireApproval || 'never',
      allowed_tools: config.allowedTools || []
    }),

    // Built-in specific fields
    ...(config.type === 'builtin' && {
      handler: config.handler
    })
  };
}

// Function to get all available tools from unified registry
export function getAvailableTools() {
  return { ...UNIFIED_TOOL_REGISTRY };
}

// Helper function to get tools by namespace
export function getToolsByNamespace(namespace) {
  return Object.values(UNIFIED_TOOL_REGISTRY).filter(tool => tool.namespace === namespace);
}

// Helper function to get routing information for system prompts
export function getRoutingInfo() {
  const routingInfo = {};

  Object.values(UNIFIED_TOOL_REGISTRY).forEach(tool => {
    if (!routingInfo[tool.namespace]) {
      routingInfo[tool.namespace] = [];
    }
    routingInfo[tool.namespace].push({
      id: tool.id,
      description: tool.description,
      keywords: tool.routing_keywords || [],
      examples: tool.examples || []
    });
  });

  return routingInfo;
}

// Store for Salesforce session credentials (in-memory, per-instance)
const salesforceCredentials = new Map();

// Helper function to get or create Salesforce session ID
export function getSalesforceSessionId(userId = 'default') {
  return salesforceCredentials.get(userId);
}

// Helper function to set Salesforce session credentials
export function setSalesforceCredentials(userId = 'default', credentials) {
  salesforceCredentials.set(userId, credentials);
}

// Helper function to clear Salesforce credentials
export function clearSalesforceCredentials(userId = 'default') {
  salesforceCredentials.delete(userId);
}

// Helper function to process authentication for MCP tools based on registry auth config
export function processToolAuth(toolConfig, userId = 'default') {
  const authConfig = toolConfig.auth || { type: 'none' };
  const result = {
    shouldInclude: true,
    headers: {},
    error: null
  };

  switch (authConfig.type) {
    case 'none':
      // No authentication required
      break;

    case 'salesforce_session':
      // Salesforce session-based authentication
      const sfCreds = getSalesforceSessionId(userId);
      if (!sfCreds) {
        result.shouldInclude = false;
        result.error = `No Salesforce credentials configured for ${toolConfig.id}. Please configure in the Salesforce MCP section.`;
        break;
      }

      // Add state/session_id to query params or body (handled by MCP server)
      result.headers['X-Salesforce-Session'] = sfCreds.state || sfCreds.session_id;
      result.headers['X-Salesforce-Access-Token'] = sfCreds.access_token;
      result.headers['X-Salesforce-Instance-URL'] = sfCreds.instance_url;
      break;

    case 'env_header':
      // Header authentication using environment variable
      if (!authConfig.header || !authConfig.env) {
        result.shouldInclude = false;
        result.error = `Invalid auth config: missing header or env field for ${toolConfig.id}`;
        break;
      }

      const envValue = Deno.env.get(authConfig.env);
      if (!envValue) {
        result.shouldInclude = false;
        result.error = `Missing environment variable: ${authConfig.env} for ${toolConfig.id}`;
        break;
      }

      result.headers[authConfig.header] = envValue;
      break;

    case 'bearer_token':
      // Bearer token authentication using environment variable
      if (!authConfig.env) {
        result.shouldInclude = false;
        result.error = `Invalid auth config: missing env field for bearer token auth for ${toolConfig.id}`;
        break;
      }

      const bearerToken = Deno.env.get(authConfig.env);
      if (!bearerToken) {
        result.shouldInclude = false;
        result.error = `Missing environment variable: ${authConfig.env} for ${toolConfig.id}`;
        break;
      }

      result.headers['Authorization'] = `Bearer ${bearerToken}`;
      break;

    case 'api_key':
      // Generic API key authentication
      if (!authConfig.env) {
        result.shouldInclude = false;
        result.error = `Invalid auth config: missing env field for api_key auth for ${toolConfig.id}`;
        break;
      }

      const apiKey = Deno.env.get(authConfig.env);
      if (!apiKey) {
        result.shouldInclude = false;
        result.error = `Missing environment variable: ${authConfig.env} for ${toolConfig.id}`;
        break;
      }

      const keyHeader = authConfig.header || 'X-API-Key';
      result.headers[keyHeader] = apiKey;
      break;

    default:
      result.shouldInclude = false;
      result.error = `Unknown auth type: ${authConfig.type} for ${toolConfig.id}`;
      break;
  }

  return result;
}


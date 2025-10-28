/**
 * Unified Tool Registry
 * Single source of truth for all tools (MCP and built-in)
 */

// Import handlers for built-in tools (will be set after export)
let getWeather, performWebSearch, answerDirectly;

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
    server_label: 'Huggingface', // Match curl example exactly
    server_url: 'https://huggingface.co/mcp',
    headers: {},
    require_approval: 'always', // Match curl example
    allowed_tools: null, // Match curl example (null means allow all)
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
    routing_keywords: ['salesforce', 'crm', 'lead', 'leads', 'contact', 'contacts', 'account', 'accounts', 'opportunity', 'opportunities', 'soql', 'query', 'sales', 'SELECT', 'FROM', 'WHERE', 'LIMIT', 'task', 'note', 'convert', 'pipeline', 'deal', 'prospect', 'customer', 'bob', 'jones', 'email', 'send', 'remember', 'remind', 'follow up', 'note about', 'add note'],
    trigger_prompt: 'Use this for ANY sales or CRM-related requests. This tool handles: 1) Lead management (create/search/update/convert leads), 2) Account management (companies), 3) Contact management (people), 4) Opportunity management (deals/pipeline), 5) Task management (follow-ups), 6) Note management (conversation logs - use sf_create_note to add notes to contacts/leads), 7) SOQL queries (any SELECT query), 8) General record operations (get/update any record type). IMPORTANT: When users say "add a note to [person]" or "remind me to email [person]", use sf_search_contacts to find the contact, then use sf_create_note to add the note. The MCP server will intelligently select the right function from 30+ available operations.',
    // NEW: Persistent focus/goal feature - stores the current sales focus (e.g., "working on Bob Jones deal ID 00Q...")
    focus_goal: null, // Will be set dynamically when user sets a focus
    server_label: 'Salesforce',
    server_url: '', // Will be set dynamically
    require_approval: 'never',
    allowed_tools: null, // null = allow all tools (MCP server has 30+ functions available)
    mcp_functions: [
      // Authentication & Setup
      { name: 'sf_login', description: 'Get an OAuth login URL & session ID', params: [] },
      { name: 'sf_get_session_info', description: 'Retrieve the current MCP session ID (useful for linking web auth)', params: [] },
      { name: 'sf_getting_started', description: 'Step-by-step guidance for using the Salesforce MCP tools', params: [] },
      { name: 'sf_start_oauth', description: 'Initiate the OAuth flow – returns a clickable URL', params: [] },
      { name: 'sf_auth_help', description: 'Get instructions and URLs for setting up Salesforce credentials', params: [] },
      { name: 'sf_auth_status', description: 'Check if authenticated; if not, provides an OAuth URL', params: [] },
      { name: 'sf_health_check', description: 'Health/status check of the Salesforce MCP server', params: [] },
      { name: 'sf_set_credentials', description: 'Store the access token and instance URL for the current session', params: ['access_token', 'instance_url'] },
      { name: 'sf_use_oauth_state', description: 'Finish a web‑OAuth flow by supplying the state string', params: ['state'] },
      { name: 'sf_debug_credentials', description: 'Test credential storage and retrieval', params: [] },
      
      // Lead Management
      { name: 'sf_create_lead', description: 'Create a new Lead record', params: ['first_name', 'last_name', 'company', 'email', 'phone', 'status'] },
      { name: 'sf_search_leads', description: 'Search for Leads by company, email, status, etc. Use for "get leads", "show leads", "find leads"', params: ['company', 'name', 'email', 'status', 'limit'] },
      { name: 'sf_update_lead', description: 'Update an existing Lead', params: ['lead_id', 'fields'] },
      { name: 'sf_convert_lead', description: 'Convert a Lead into an Account/Contact/Opportunity', params: ['lead_id', 'account_name', 'opportunity_name'] },
      
      // Contact Management
      { name: 'sf_create_contact', description: 'Create a new Contact (person)', params: ['first_name', 'last_name', 'email', 'phone', 'account_id'] },
      { name: 'sf_search_contacts', description: 'Search for Contacts by email, name, phone. USE THIS to find contacts before adding notes!', params: ['email', 'last_name', 'first_name', 'phone', 'account_id', 'limit'] },
      
      // Account Management
      { name: 'sf_create_account', description: 'Create a new Account (company)', params: ['name', 'industry', 'type', 'phone', 'website'] },
      { name: 'sf_search_accounts', description: 'Search for Accounts (companies) by name, industry, type', params: ['name', 'industry', 'type', 'limit'] },
      
      // Opportunity Management
      { name: 'sf_create_opportunity', description: 'Create a new Opportunity (deal)', params: ['name', 'account_id', 'stage', 'amount', 'close_date'] },
      { name: 'sf_search_opportunities', description: 'Search for Opportunities (deals) by stage, amount, name', params: ['stage', 'name', 'account_id', 'amount_min', 'limit'] },
      
      // Task Management
      { name: 'sf_create_task', description: 'Create a new Task (activity/follow-up)', params: ['subject', 'status', 'priority', 'related_to_id', 'due_date', 'description'] },
      { name: 'sf_search_tasks', description: 'Search for Tasks by status, subject, related record', params: ['status', 'subject', 'related_to_id', 'limit'] },
      
      // Note Management (IMPORTANT FOR YOUR USE CASE!)
      { name: 'sf_create_note', description: 'Add a note to any Salesforce record (Contact, Lead, Account, Opportunity, etc.). Use parent_id for the record ID. CRITICAL: Always search for the contact/lead FIRST to get their ID, then use that ID as parent_id.', params: ['parent_id', 'title', 'body'] },
      { name: 'sf_search_notes', description: 'Search for notes (filter by parent record, title, etc.)', params: ['parent_id', 'title', 'limit'] },
      { name: 'sf_update_note', description: 'Update an existing note', params: ['note_id', 'title', 'body'] },
      { name: 'sf_delete_note', description: 'Delete a note', params: ['note_id'] },
      { name: 'sf_get_note', description: 'Retrieve a single note by ID', params: ['note_id'] },
      
      // Generic Record Operations
      { name: 'sf_run_soql_query', description: 'Execute any SOQL query (SELECT queries). Use for complex searches, reporting, or when other functions don\'t fit', params: ['query'] },
      { name: 'sf_get_record', description: 'Get any record by ID with optional field selection', params: ['sobject_type', 'record_id', 'fields'] },
      { name: 'sf_update_record', description: 'Update any record type (generic update function)', params: ['sobject_type', 'record_id', 'fields'] }
    ],
    auth: { type: 'salesforce_session' }, // Custom auth type for Salesforce session-based auth
    examples: [
      'search for leads in Acme Corp', 
      'create a new lead for John Doe', 
      'run SOQL query SELECT Id, Name FROM Lead LIMIT 10', 
      'get the latest leads', 
      'show me salesforce accounts',
      'create a new opportunity',
      'add a note to Bob Jones about emailing examples',
      'search for contact Bob Jones',
      'update the lead status',
      'search for opportunities in pipeline',
      'create a follow-up task',
      'remind me to email Bob',
      'add a note to this contact'
    ]
  },

  // Built-in Tools (handlers will be set dynamically)
  weather: {
    id: 'weather',
    type: 'builtin',
    category: 'utility',
    namespace: 'general',
    displayName: '🌤️ Weather',
    description: 'Weather information using Groq compound model',
    routing_keywords: ['weather', 'temperature', 'forecast', 'climate', 'rain', 'sunny', 'cloudy', 'humidity', 'wind'],
    trigger_prompt: 'Use this when users ask about weather, temperature, forecast, or climate conditions in any location.',
    handler: null, // Will be set via setBuiltinHandlers
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
    handler: null, // Will be set via setBuiltinHandlers
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
    handler: null, // Will be set via setBuiltinHandlers
    examples: ['explain machine learning', 'what is quantum computing', 'how does the internet work']
  },

  update_directives: {
    id: 'update_directives',
    type: 'builtin',
    category: 'context',
    namespace: 'general',
    displayName: '📋 Update Directives',
    description: 'BACKGROUND TOOL: Sets behavioral rules/constraints. NOT for answering user questions.',
    routing_keywords: [],  // Remove keywords so it's not the primary response
    trigger_prompt: '⚠️ IMPORTANT: This is a BACKGROUND/OPTIONAL tool. DO NOT use as the primary response!\n\n**When to use this:**\n- User explicitly requests behavioral changes ("always respond in French", "keep responses short")\n- AFTER answering the user\'s question, if they mentioned a persistent preference\n\n**DO NOT use this as the primary response to questions!**\n- If user asks a question, answer it first with groq_compound/salesforce/weather\n- Only update directives if user specified a PERSISTENT BEHAVIORAL RULE\n\n**What belongs here:**\n- Response format rules ("Keep all responses under 3 sentences")\n- Language preferences ("Always respond in French")\n- Tool constraints ("Limit web searches to Reddit only")\n- Persistent focus ("Focus all Salesforce actions on Bob Jones deal")\n\n**DO NOT use for:**\n- Conversation notes (use update_scratchpad)\n- Current one-time requests\n- User\'s questions',
    handler: null, // Will be set via setBuiltinHandlers
    params: [
      { name: 'newContent', type: 'string', description: 'Behavioral rules/constraints (replaces existing). Clear instructions.', required: true }
    ],
    examples: [
      'Always respond in French',
      'Keep all responses under 3 sentences',
      'Limit web searches to Reddit only',
      'Focus all Salesforce actions on Bob Jones deal'
    ]
  },

  update_scratchpad: {
    id: 'update_scratchpad',
    type: 'builtin',
    category: 'context',
    namespace: 'general',
    displayName: '📝 Update Scratch Pad',
    description: 'DEPRECATED - Use scratchpad_update field in JSON response instead. Do not select this tool.',
    routing_keywords: [], // Disabled - router should use scratchpad_update field instead
    hidden: true, // Hide from tool list
    trigger_prompt: '**CRITICAL: This tool REPLACES the entire scratchpad content! Always include existing content + new content.**\n\n**TWO MODES FOR THIS TOOL:**\n\n**MODE 1: EXPLICIT REQUEST (Primary Response) - USER WANTS TO ADD/SAVE CONTENT**\n- User says "add that to the scratchpad" or "save to notes"\n- Use this tool as the PRIMARY response\n- ⚠️ **DO NOT copy the user\'s command!** Look at CHAT HISTORY for the PREVIOUS AI RESPONSE\n- The content to save is in the ASSISTANT\'s PREVIOUS MESSAGE (not the user\'s current message)\n- Check the system prompt "📝 SCRATCH PAD NOTES" section for EXISTING content\n- APPEND new content to existing, don\'t replace\n\n**STEP-BY-STEP FOR MODE 1:**\n1. Look at chat history → find the LAST assistant message (before user\'s current request)\n2. Extract the useful content from that assistant message\n3. Check system prompt → find current scratchpad content in "📝 SCRATCH PAD NOTES" section\n4. Format: `[existing scratchpad]\\n\\n[timestamp] [new content from previous assistant message]`\n5. Pass the FULL combined content to newContent parameter\n\n**MODE 2: BACKGROUND NOTE-TAKING (Optional)**\n- AFTER answering a question with another tool (groq_compound/salesforce/weather)\n- Optionally add contextual notes about what was discussed\n- Write ABOUT the conversation, not literal quotes\n\n**EXAMPLE - User says "add that to notes" after getting restaurant list:**\n```\nChat History:\n  User: "what are good restaurants in Palo Alto?"\n  Assistant: "Here are 10 great restaurants: 1. Mangia (4165 El Camino Real)..."\n  User: "add that to notes"  ← Current message\n\nCurrent scratchpad (from system prompt): "User likes Italian food"\n\nYour newContent should be:\n"User likes Italian food\\n\\n[Oct 28, 10:31 AM] Restaurant recommendations for Palo Alto:\\n- Mangia: 4165 El Camino Real, Italian, $10-13\\n- Tacos La Victoria: 4253 El Camino Real, Mexican, $6-9\\n[... rest of list ...]"\n```\n\n❌ **WRONG - Don\'t copy user\'s command:**\n"add that to notes"\n\n✅ **CORRECT - Extract from previous assistant response:**\n"[existing content]\\n\\n[Oct 28] Restaurant recommendations for Palo Alto:\\n- Mangia: ...\\n- Tacos La Victoria: ..."\n\nAlways look at CHAT HISTORY to find what "that" refers to!',
    handler: null, // Will be set via setBuiltinHandlers
    params: [
      { name: 'newContent', type: 'string', description: 'CONTEXTUAL SUMMARY or FORMATTED CONTENT from previous responses. Concise bullet points or structured notes.', required: true }
    ],
    examples: [
      'User researching Palo Alto restaurants for team dinner (8 people), prefers budget-friendly options, likes Italian',
      'Project deadline: Dec 15. Team: Alice (PM), Bob (Dev). Focusing on mobile-first design',
      'User wants date trip recommendations, prefers casual Alpine Inn vibe, looking for cocktail/beer spots'
    ]
  }
};

// Function to set built-in tool handlers after they're defined in main.js
export function setBuiltinHandlers(handlers) {
  if (handlers.getWeather) UNIFIED_TOOL_REGISTRY.weather.handler = handlers.getWeather;
  if (handlers.performWebSearch) UNIFIED_TOOL_REGISTRY.groq_compound.handler = handlers.performWebSearch;
  if (handlers.answerDirectly) UNIFIED_TOOL_REGISTRY.direct_answer.handler = handlers.answerDirectly;
  if (handlers.updateDirectives) UNIFIED_TOOL_REGISTRY.update_directives.handler = handlers.updateDirectives;
  if (handlers.updateScratchPad) UNIFIED_TOOL_REGISTRY.update_scratchpad.handler = handlers.updateScratchPad;
}

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


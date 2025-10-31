/**
 * Tool Registry Core Utilities
 * Framework for managing tools (both MCP and built-in) across agents
 */

/**
 * Tool Registry Class
 * Manages a collection of tools with methods for adding, retrieving, and filtering
 */
export class ToolRegistry {
  constructor() {
    this.tools = {};
  }

  /**
   * Add a tool to the registry
   * @param {string} toolId - Unique tool identifier
   * @param {Object} config - Tool configuration
   * @returns {void}
   */
  addTool(toolId, config) {
    this.tools[toolId] = {
      id: toolId,
      type: config.type || 'builtin',
      category: config.category || 'general',
      namespace: config.namespace || 'general',
      displayName: config.displayName || `⚙️ ${toolId}`,
      description: config.description || `${toolId} tool`,
      routing_keywords: config.routing_keywords || [],
      trigger_prompt: config.trigger_prompt || '',
      examples: config.examples || [],

      // MCP-specific fields
      ...(config.type === 'mcp' && {
        server_label: config.serverLabel || toolId,
        server_url: config.serverUrl || '',
        headers: config.headers || {},
        require_approval: config.requireApproval || 'never',
        allowed_tools: config.allowedTools || null,
        mcp_functions: config.mcpFunctions || [],
        auth: config.auth || { type: 'none' }
      }),

      // Built-in specific fields
      ...(config.type === 'builtin' && {
        handler: config.handler || null
      }),

      // Additional custom fields
      ...config.custom
    };

    console.log(`🔧 Tool registered: ${toolId} (${config.type})`);
  }

  /**
   * Remove a tool from the registry
   * @param {string} toolId - Tool identifier to remove
   * @returns {boolean} True if tool was removed
   */
  removeTool(toolId) {
    if (this.tools[toolId]) {
      delete this.tools[toolId];
      console.log(`🗑️ Tool removed: ${toolId}`);
      return true;
    }
    return false;
  }

  /**
   * Get all tools
   * @returns {Object} All tools in the registry
   */
  getAll() {
    return { ...this.tools };
  }

  /**
   * Get a specific tool by ID
   * @param {string} toolId - Tool identifier
   * @returns {Object|null} Tool config or null if not found
   */
  getTool(toolId) {
    return this.tools[toolId] || null;
  }

  /**
   * Get tools by namespace
   * @param {string} namespace - Namespace to filter by
   * @returns {Array} Array of tools in the namespace
   */
  getByNamespace(namespace) {
    return Object.values(this.tools).filter(tool => tool.namespace === namespace);
  }

  /**
   * Get tools by category
   * @param {string} category - Category to filter by
   * @returns {Array} Array of tools in the category
   */
  getByCategory(category) {
    return Object.values(this.tools).filter(tool => tool.category === category);
  }

  /**
   * Get tools by type (mcp or builtin)
   * @param {string} type - Type to filter by
   * @returns {Array} Array of tools of the specified type
   */
  getByType(type) {
    return Object.values(this.tools).filter(tool => tool.type === type);
  }

  /**
   * Get routing information for system prompts
   * @returns {Object} Routing information grouped by namespace
   */
  getRoutingInfo() {
    const routingInfo = {};

    Object.values(this.tools).forEach(tool => {
      if (!routingInfo[tool.namespace]) {
        routingInfo[tool.namespace] = [];
      }
      routingInfo[tool.namespace].push({
        id: tool.id,
        displayName: tool.displayName,
        description: tool.description,
        keywords: tool.routing_keywords || [],
        trigger_prompt: tool.trigger_prompt || '',
        examples: tool.examples || []
      });
    });

    return routingInfo;
  }

  /**
   * Set handler for a built-in tool
   * @param {string} toolId - Tool identifier
   * @param {Function} handler - Handler function
   * @returns {boolean} True if handler was set
   */
  setHandler(toolId, handler) {
    const tool = this.tools[toolId];
    if (tool && tool.type === 'builtin') {
      tool.handler = handler;
      console.log(`✅ Handler set for: ${toolId}`);
      return true;
    }
    console.warn(`⚠️ Cannot set handler for: ${toolId} (not found or not a builtin tool)`);
    return false;
  }

  /**
   * Set multiple handlers at once
   * @param {Object} handlers - Object mapping tool IDs to handler functions
   * @returns {void}
   */
  setHandlers(handlers) {
    Object.entries(handlers).forEach(([toolId, handler]) => {
      this.setHandler(toolId, handler);
    });
  }

  /**
   * Validate tool configuration
   * @param {string} toolId - Tool identifier
   * @param {Object} config - Tool configuration to validate
   * @returns {Object} Validation result with success and errors
   */
  validateToolConfig(toolId, config) {
    const errors = [];

    // Required fields
    if (!config.type) {
      errors.push('Missing required field: type');
    }

    if (!config.description) {
      errors.push('Missing required field: description');
    }

    // Type-specific validation
    if (config.type === 'mcp') {
      if (!config.serverUrl && !config.serverLabel) {
        errors.push('MCP tools require serverUrl or serverLabel');
      }
    }

    if (config.type === 'builtin') {
      if (!config.handler) {
        errors.push('Builtin tools require a handler function');
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Get tool count by type
   * @returns {Object} Count of tools by type
   */
  getStats() {
    const stats = {
      total: Object.keys(this.tools).length,
      byType: {},
      byCategory: {},
      byNamespace: {}
    };

    Object.values(this.tools).forEach(tool => {
      // Count by type
      stats.byType[tool.type] = (stats.byType[tool.type] || 0) + 1;

      // Count by category
      stats.byCategory[tool.category] = (stats.byCategory[tool.category] || 0) + 1;

      // Count by namespace
      stats.byNamespace[tool.namespace] = (stats.byNamespace[tool.namespace] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear all tools
   * @returns {void}
   */
  clear() {
    this.tools = {};
    console.log('🗑️ All tools cleared');
  }

  /**
   * Import tools from a configuration object
   * @param {Object} toolsConfig - Object mapping tool IDs to configs
   * @returns {number} Number of tools imported
   */
  importTools(toolsConfig) {
    let imported = 0;
    Object.entries(toolsConfig).forEach(([toolId, config]) => {
      this.addTool(toolId, config);
      imported++;
    });
    console.log(`📦 Imported ${imported} tools`);
    return imported;
  }
}

/**
 * Helper function to create a tool configuration object
 * @param {Object} params - Tool parameters
 * @returns {Object} Tool configuration
 */
export function createToolConfig(params) {
  const {
    type,
    category = 'general',
    namespace = 'general',
    displayName,
    description,
    routingKeywords = [],
    triggerPrompt = '',
    examples = [],
    // MCP-specific
    serverLabel,
    serverUrl,
    headers = {},
    requireApproval = 'never',
    allowedTools = null,
    mcpFunctions = [],
    auth = { type: 'none' },
    // Builtin-specific
    handler = null,
    // Custom
    custom = {}
  } = params;

  return {
    type,
    category,
    namespace,
    displayName,
    description,
    routing_keywords: routingKeywords,
    trigger_prompt: triggerPrompt,
    examples,
    ...(type === 'mcp' && {
      serverLabel,
      serverUrl,
      headers,
      requireApproval,
      allowedTools,
      mcpFunctions,
      auth
    }),
    ...(type === 'builtin' && {
      handler
    }),
    custom
  };
}

/**
 * Helper function to create an MCP tool configuration
 * @param {Object} params - MCP tool parameters
 * @returns {Object} MCP tool configuration
 */
export function createMcpToolConfig(params) {
  return createToolConfig({
    ...params,
    type: 'mcp'
  });
}

/**
 * Helper function to create a built-in tool configuration
 * @param {Object} params - Built-in tool parameters
 * @returns {Object} Built-in tool configuration
 */
export function createBuiltinToolConfig(params) {
  return createToolConfig({
    ...params,
    type: 'builtin'
  });
}

/**
 * Authentication and Credentials Management Utilities
 * Handles various authentication flows for MCP tools and services
 *
 * IMPORTANT: In-memory storage (Map) works for localhost but NOT for serverless deployments
 * Solution: Applications should pass credentials with each request
 * Fallback: In-memory Map for backward compatibility with localhost
 */

/**
 * Credential Store
 * Manages credentials for different users and services
 */
export class CredentialStore {
  constructor() {
    this.credentials = new Map();
  }

  /**
   * Get credentials for a user and service
   * @param {string} userId - User identifier
   * @param {string} serviceId - Service identifier (optional)
   * @returns {Object|null} Credentials or null if not found
   */
  get(userId = 'default', serviceId = null) {
    if (serviceId) {
      const userCreds = this.credentials.get(userId);
      return userCreds ? userCreds[serviceId] : null;
    }
    return this.credentials.get(userId);
  }

  /**
   * Set credentials for a user and service
   * @param {string} userId - User identifier
   * @param {Object} credentials - Credentials object
   * @param {string} serviceId - Service identifier (optional)
   * @returns {void}
   */
  set(userId = 'default', credentials, serviceId = null) {
    if (serviceId) {
      if (!this.credentials.has(userId)) {
        this.credentials.set(userId, {});
      }
      this.credentials.get(userId)[serviceId] = credentials;
    } else {
      this.credentials.set(userId, credentials);
    }
  }

  /**
   * Clear credentials for a user and service
   * @param {string} userId - User identifier
   * @param {string} serviceId - Service identifier (optional)
   * @returns {void}
   */
  clear(userId = 'default', serviceId = null) {
    if (serviceId) {
      const userCreds = this.credentials.get(userId);
      if (userCreds) {
        delete userCreds[serviceId];
      }
    } else {
      this.credentials.delete(userId);
    }
  }

  /**
   * Check if credentials exist for a user and service
   * @param {string} userId - User identifier
   * @param {string} serviceId - Service identifier (optional)
   * @returns {boolean} True if credentials exist
   */
  has(userId = 'default', serviceId = null) {
    if (serviceId) {
      const userCreds = this.credentials.get(userId);
      return userCreds ? !!userCreds[serviceId] : false;
    }
    return this.credentials.has(userId);
  }

  /**
   * Clear all credentials
   * @returns {void}
   */
  clearAll() {
    this.credentials.clear();
  }
}

/**
 * Process authentication for MCP tools based on auth configuration
 * @param {Object} toolConfig - Tool configuration with auth settings
 * @param {string} userId - User identifier
 * @param {Headers|Object} requestHeaders - HTTP headers from incoming request (for bearer token passthrough)
 * @param {CredentialStore} credentialStore - Credential store instance
 * @param {Function} getEnv - Function to get environment variables (defaults to Deno.env.get or process.env)
 * @returns {Object} Auth result with shouldInclude, headers, and error
 */
export function processToolAuth(toolConfig, userId = 'default', requestHeaders = null, credentialStore = null, getEnv = null) {
  const authConfig = toolConfig.auth || { type: 'none' };
  const result = {
    shouldInclude: true,
    headers: {},
    error: null
  };

  // Default env getter
  if (!getEnv) {
    if (typeof Deno !== 'undefined' && Deno.env) {
      getEnv = (key) => Deno.env.get(key);
    } else if (typeof process !== 'undefined' && process.env) {
      getEnv = (key) => process.env[key];
    } else {
      getEnv = () => null;
    }
  }

  switch (authConfig.type) {
    case 'none':
      // No authentication required
      break;

    case 'salesforce_session':
      // Salesforce session-based authentication
      // Check for bearer token in request headers first (passthrough from client)
      if (requestHeaders) {
        const authHeader = requestHeaders.get?.('Authorization') || requestHeaders['Authorization'];
        const instanceUrl = requestHeaders.get?.('X-Salesforce-Instance-Url') || requestHeaders['X-Salesforce-Instance-Url'];

        if (authHeader && authHeader.startsWith('Bearer ') && instanceUrl) {
          // Extract bearer token and use it
          const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
          result.headers['X-Salesforce-Session'] = `bearer_${Date.now()}`;
          result.headers['X-Salesforce-Access-Token'] = accessToken;
          result.headers['X-Salesforce-Instance-URL'] = instanceUrl;
          console.log(`🔐 Using bearer token from request headers for ${toolConfig.id}`);
          break;
        }
      }

      // Fallback to stored credentials
      if (credentialStore) {
        const sfCreds = credentialStore.get(userId, 'salesforce') || credentialStore.get(userId);
        if (!sfCreds) {
          result.shouldInclude = false;
          result.error = `No Salesforce credentials configured for ${toolConfig.id}. Please configure in the Salesforce section.`;
          break;
        }

        // Add state/session_id to headers
        result.headers['X-Salesforce-Session'] = sfCreds.state || sfCreds.session_id;
        result.headers['X-Salesforce-Access-Token'] = sfCreds.access_token;
        result.headers['X-Salesforce-Instance-URL'] = sfCreds.instance_url;
      } else {
        result.shouldInclude = false;
        result.error = `No credential store provided for ${toolConfig.id}`;
      }
      break;

    case 'env_header':
      // Header authentication using environment variable
      if (!authConfig.header || !authConfig.env) {
        result.shouldInclude = false;
        result.error = `Invalid auth config: missing header or env field for ${toolConfig.id}`;
        break;
      }

      const envValue = getEnv(authConfig.env);
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

      const bearerToken = getEnv(authConfig.env);
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

      const apiKey = getEnv(authConfig.env);
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

/**
 * Extract bearer token from authorization header
 * @param {Headers|Object} requestHeaders - HTTP headers
 * @returns {string|null} Bearer token or null if not found
 */
export function extractBearerToken(requestHeaders) {
  if (!requestHeaders) return null;

  const authHeader = requestHeaders.get?.('Authorization') || requestHeaders['Authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  return null;
}

/**
 * Validate credentials object
 * @param {Object} credentials - Credentials to validate
 * @param {Array<string>} requiredFields - Required field names
 * @returns {Object} Validation result with success and errors
 */
export function validateCredentials(credentials, requiredFields = []) {
  const errors = [];

  if (!credentials || typeof credentials !== 'object') {
    return {
      success: false,
      errors: ['Credentials must be an object']
    };
  }

  requiredFields.forEach(field => {
    if (!credentials[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Create auth headers for a tool
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} credentials - Credentials object
 * @returns {Object} Headers object
 */
export function createAuthHeaders(authConfig, credentials) {
  const headers = {};

  switch (authConfig.type) {
    case 'bearer_token':
      if (credentials.access_token) {
        headers['Authorization'] = `Bearer ${credentials.access_token}`;
      }
      break;

    case 'api_key':
      const keyHeader = authConfig.header || 'X-API-Key';
      if (credentials.api_key) {
        headers[keyHeader] = credentials.api_key;
      }
      break;

    case 'salesforce_session':
      if (credentials.access_token) {
        headers['X-Salesforce-Access-Token'] = credentials.access_token;
      }
      if (credentials.instance_url) {
        headers['X-Salesforce-Instance-URL'] = credentials.instance_url;
      }
      if (credentials.session_id || credentials.state) {
        headers['X-Salesforce-Session'] = credentials.session_id || credentials.state;
      }
      break;
  }

  return headers;
}

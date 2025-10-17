/**
 * Authentication and Credentials Management
 * Handles Salesforce and other authentication flows
 * 
 * IMPORTANT: In-memory storage (Map) works for localhost but NOT for Deno Deploy (serverless)
 * Solution: Frontend sends credentials with each request via localStorage
 * Fallback: In-memory Map for backward compatibility with localhost
 */

// Store for Salesforce session credentials (in-memory, per-instance)
// NOTE: This persists on localhost but resets on each Deno Deploy isolate/request
const salesforceCredentials = new Map();

// Helper function to get or create Salesforce session ID
export function getSalesforceSessionId(userId = 'default') {
  return salesforceCredentials.get(userId);
}

// Helper function to set Salesforce session credentials
export function setSalesforceCredentials(userId = 'default', credentials) {
  salesforceCredentials.set(userId, credentials);
}

// Helper function to delete Salesforce credentials
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


/**
 * Salesforce MCP Credential Management Routes
 * Handles OAuth flow and credential management for Salesforce integration
 */

import {
  getSalesforceSessionId,
  setSalesforceCredentials,
  clearSalesforceCredentials
} from "./auth-utils.js";
import { SALESFORCE_MCP_URL } from "./config.js";

// Get Salesforce credentials status
export function getSalesforceStatus(c) {
  const userId = c.req.query('userId') || 'default';
  const creds = getSalesforceSessionId(userId);
  
  return c.json({
    configured: !!creds,
    hasAccessToken: !!(creds?.access_token),
    hasInstanceUrl: !!(creds?.instance_url),
    sessionId: creds?.state || creds?.session_id || null,
    mcpServerUrl: SALESFORCE_MCP_URL
  });
}

// Request OAuth URL from Salesforce MCP wrapper
export async function getSalesforceOAuthUrl(c) {
  try {
    // Get the current app URL for callback
    const protocol = c.req.header('x-forwarded-proto') || 'http';
    const host = c.req.header('host') || 'localhost:8000';
    const redirectUri = `${protocol}://${host}/salesforce/oauth/callback`;
    
    const mcpUrl = `${SALESFORCE_MCP_URL}/api/oauth-url?redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log(`🔗 Calling Salesforce MCP wrapper: ${mcpUrl}`);
    
    // Call the Salesforce MCP wrapper to get OAuth URL
    const response = await fetch(mcpUrl);
    
    console.log(`📡 MCP wrapper responded with status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ MCP wrapper error response: ${errorText}`);
      throw new Error(`Failed to get OAuth URL: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Got OAuth URL from MCP wrapper`);
    
    return c.json({
      success: true,
      oauthUrl: data.oauth_url,
      state: data.state,
      redirectUri: redirectUri,
      instructions: data.instructions
    });
  } catch (error) {
    console.error('❌ Error getting OAuth URL:', error);
    return c.json({
      success: false,
      error: error.message,
      mcpServerUrl: SALESFORCE_MCP_URL
    }, 500);
  }
}

// OAuth callback handler (receives code from Salesforce)
export async function handleSalesforceOAuthCallback(c) {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  
  // Handle OAuth errors
  if (error) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salesforce OAuth Error</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 p-8">
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-6">
            <div class="text-6xl mb-4">❌</div>
            <h1 class="text-2xl font-bold text-red-600 mb-2">OAuth Error</h1>
            <p class="text-gray-600">Failed to authenticate with Salesforce</p>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800 font-medium">Error: ${error}</p>
          </div>
          <div class="text-center">
            <a href="/" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              ← Back to App
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  
  // Missing code parameter
  if (!code) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 p-8">
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-6">
            <div class="text-6xl mb-4">⚠️</div>
            <h1 class="text-2xl font-bold text-yellow-600 mb-2">Missing Authorization Code</h1>
            <p class="text-gray-600">No authorization code received from Salesforce</p>
          </div>
          <div class="text-center">
            <a href="/" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              ← Back to App
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  
  try {
    // Exchange code for tokens via Salesforce MCP wrapper
    const protocol = c.req.header('x-forwarded-proto') || 'http';
    const host = c.req.header('host') || 'localhost:8000';
    const redirectUri = `${protocol}://${host}/salesforce/oauth/callback`;
    
    const response = await fetch(`${SALESFORCE_MCP_URL}/api/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        state,
        redirect_uri: redirectUri
      })
    });
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Token exchange failed');
    }
    
    // Store credentials
    const credentials = {
      access_token: result.access_token,
      instance_url: result.instance_url,
      state: result.state || state,
      timestamp: Date.now()
    };
    
    setSalesforceCredentials('default', credentials);
    
    console.log(`✅ Salesforce OAuth completed successfully - Instance: ${result.instance_url}`);
    
    // Show success page
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salesforce Connected</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 p-8">
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-6">
            <div class="text-6xl mb-4">✅</div>
            <h1 class="text-2xl font-bold text-green-600 mb-2">Salesforce Connected!</h1>
            <p class="text-gray-600">Your Salesforce credentials have been saved successfully</p>
          </div>
          
          <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 space-y-2">
            <div class="flex items-start gap-3">
              <span class="text-green-600 font-semibold min-w-[120px]">Instance URL:</span>
              <span class="text-gray-700 break-all">${result.instance_url}</span>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-green-600 font-semibold min-w-[120px]">Session ID:</span>
              <code class="text-gray-700 bg-gray-100 px-2 py-1 rounded text-sm">${credentials.state}</code>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-green-600 font-semibold min-w-[120px]">Status:</span>
              <span class="text-green-700 font-medium">Ready to use</span>
            </div>
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 class="font-semibold text-blue-900 mb-2">🎉 What's Next?</h3>
            <ul class="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Go back to the app and start using Salesforce tools</li>
              <li>Try: "Hey Groq, search for leads in Acme Corp"</li>
              <li>Try: "Hey Groq, create a new lead for John Doe"</li>
              <li>Try: "Hey Groq, show me all accounts in Salesforce"</li>
            </ul>
          </div>
          
          <div class="text-center">
            <a href="/" class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              ← Back to App
            </a>
          </div>
        </div>
        
        <script>
          // Notify parent window if opened in popup
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'salesforce-connected',
              instanceUrl: '${result.instance_url}',
              sessionId: '${credentials.state}'
            }, '*');
            
            // Auto-close popup after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          }
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 p-8">
        <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-6">
            <div class="text-6xl mb-4">❌</div>
            <h1 class="text-2xl font-bold text-red-600 mb-2">Connection Failed</h1>
            <p class="text-gray-600">Failed to exchange OAuth code for credentials</p>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800 font-medium">Error: ${error.message}</p>
          </div>
          <div class="text-center space-x-4">
            <a href="/" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              ← Back to App
            </a>
            <button onclick="window.location.reload()" class="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors">
              🔄 Try Again
            </button>
          </div>
        </div>
      </body>
      </html>
    `);
  }
}

// Set Salesforce credentials (for copy-paste flow)
export async function setSalesforceCredentialsRoute(c) {
  try {
    const body = await c.req.json();
    const { access_token, instance_url, state, userId = 'default' } = body;
    
    if (!access_token || !instance_url) {
      return c.json({ 
        error: 'Missing required fields: access_token and instance_url are required',
        success: false 
      }, 400);
    }
    
    // Store credentials
    const credentials = {
      access_token,
      instance_url,
      state: state || `session_${Date.now()}`,
      timestamp: Date.now()
    };
    
    setSalesforceCredentials(userId, credentials);
    
    console.log(`✅ Salesforce credentials configured for user: ${userId}`);
    
    return c.json({
      success: true,
      message: 'Salesforce credentials saved successfully',
      sessionId: credentials.state,
      instanceUrl: instance_url
    });
  } catch (error) {
    console.error('Error setting Salesforce credentials:', error);
    return c.json({ 
      error: error.message,
      success: false 
    }, 500);
  }
}

// Clear Salesforce credentials
export function clearSalesforceCredentialsRoute(c) {
  const userId = c.req.query('userId') || 'default';
  clearSalesforceCredentials(userId);
  
  return c.json({
    success: true,
    message: 'Salesforce credentials cleared'
  });
}


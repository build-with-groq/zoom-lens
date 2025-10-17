/**
 * ZOOM RTMS - AI-Powered Meeting Assistant
 * 
 * ROUTING ARCHITECTURE:
 * This application uses an AI-powered intelligent router instead of regex-based keyword matching.
 * 
 * Key Features:
 * 1. AI Router (intelligentRouter): Uses openai/gpt-oss-20b to analyze user intent
 * 2. Tool Registry (UNIFIED_TOOL_REGISTRY): Single source of truth for all tools
 * 3. MCP Function Details: Each MCP tool includes specific function definitions and parameters
 * 4. Parameter Extraction: Router automatically extracts parameters from user queries
 * 5. Flexible Tool Selection: Can handle complex, ambiguous, or multi-tool requests
 * 
 * Tool Types:
 * - MCP Tools: External services (Salesforce, HuggingFace, Parallel Search)
 * - Built-in Tools: Internal handlers (Weather, Direct Answer)
 * 
 * Router Output Format:
 * {
 *   tools: ['tool_id'],              // Array of tool IDs (backward compatible)
 *   toolDetails: [{                  // Detailed tool information
 *     tool_id: 'salesforce',
 *     functions: ['sf_search_leads'],
 *     params: { company: 'Acme Corp' }
 *   }],
 *   reasoning: 'why these tools',
 *   primaryIntent: 'intent category',
 *   confidence: 0.95
 * }
 * 
 * Migration from Regex:
 * - OLD: Simple keyword matching (if text.includes('weather') -> weather tool)
 * - NEW: AI understands intent, extracts params, selects specific functions
 * - Benefits: More flexible, handles typos, understands context, extracts structured data
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { getTailwindConfig, getStyles } from "./styles.js";
import { 
  ZOOM_CLIENT_ID, 
  ZOOM_CLIENT_SECRET, 
  ZOOM_SECRET_TOKEN, 
  WEBHOOK_PATH, 
  GROQ_API_KEY, 
  groqClient,
  SALESFORCE_MCP_URL,
  INSTANCE_ID,
  bc
} from "./config.js";
import {
  getSalesforceSessionId,
  setSalesforceCredentials,
  clearSalesforceCredentials,
  processToolAuth
} from "./auth-utils.js";
import {
  createHmacSha256,
  generateSignature
} from "./crypto-utils.js";
import {
  activeConnections,
  sseClients,
  resolveWsUrl,
  parseWsJson,
  addToRecentTranscripts,
  getRecentTranscripts,
  connectToSignalingWebSocket,
  connectToMediaWebSocket
} from "./websocket-utils.js";
import {
  UNIFIED_TOOL_REGISTRY,
  addTool,
  getAvailableTools,
  getToolsByNamespace,
  getRoutingInfo,
  setBuiltinHandlers
} from "./tool-registry-unified.js";
import {
  getSalesforceStatus,
  getSalesforceOAuthUrl,
  handleSalesforceOAuthCallback,
  setSalesforceCredentialsRoute,
  clearSalesforceCredentialsRoute
} from "./salesforce-routes.js";
import {
  setSalesforceFocus,
  getSalesforceFocus,
  clearSalesforceFocus,
  parseFocusGoal,
  suggestFocusGoals
} from "./salesforce-focus.js";
import {
  intelligentRouter,
  correctZoomSpelling,
  detectZoomTrigger,
  getWeather,
  performWebSearch,
  answerDirectly,
  performGroqInference
} from "./ai-inference.js";

// Tool registry and helper functions are now imported from tool-registry-unified.js

// Example of adding tools programmatically with different auth types:

// Example 1: MCP tool with API key header authentication
// addTool('custom_api_tool', {
//   type: 'mcp',
//   category: 'ai_ml',
//   namespace: 'custom',
//   displayName: '🤖 Custom API Tool',
//   description: 'Custom API tool with header authentication',
//   routing_keywords: ['custom', 'api', 'search'],
//   examples: ['search custom api', 'find with custom tool'],
//   serverLabel: 'CustomAPI',
//   serverUrl: 'https://api.example.com/mcp',
//   requireApproval: 'never',
//   allowedTools: ['search', 'analyze'],
//   auth: { type: 'env_header', header: 'X-API-Key', env: 'CUSTOM_API_KEY' }
// });

// Example 2: MCP tool with Bearer token authentication  
// addTool('custom_bearer_tool', {
//   type: 'mcp',
//   category: 'search',
//   namespace: 'custom',
//   displayName: '🔐 Custom Bearer Tool',
//   description: 'Custom tool with Bearer token auth',
//   routing_keywords: ['secure', 'bearer', 'auth'],
//   examples: ['secure search', 'authenticated query'],
//   serverLabel: 'SecureAPI',
//   serverUrl: 'https://secure-api.example.com/mcp',
//   requireApproval: 'always',
//   allowedTools: ['secure_search'],
//   auth: { type: 'bearer_token', env: 'SECURE_API_TOKEN' }
// });

// Example 3: MCP tool with generic API key authentication (uses X-API-Key by default)
// addTool('simple_api_tool', {
//   type: 'mcp',
//   category: 'utility',
//   namespace: 'simple',
//   displayName: '⚡ Simple API Tool',
//   description: 'Simple tool with standard API key auth',
//   routing_keywords: ['simple', 'basic', 'quick'],
//   examples: ['quick search', 'basic query'],
//   serverLabel: 'SimpleAPI',
//   serverUrl: 'https://simple.example.com/mcp',
//   requireApproval: 'never',
//   allowedTools: ['basic_search'],
//   auth: { type: 'api_key', env: 'SIMPLE_API_KEY' }
// });

// Example 4: MCP tool with no authentication required
// addTool('public_tool', {
//   type: 'mcp',
//   category: 'utility',
//   namespace: 'public',
//   displayName: '🌐 Public Tool',
//   description: 'Public tool requiring no authentication',
//   routing_keywords: ['public', 'free', 'open'],
//   examples: ['public search', 'open data'],
//   serverLabel: 'PublicAPI',
//   serverUrl: 'https://public-api.example.com/mcp',
//   requireApproval: 'never',
//   allowedTools: ['public_search'],
//   auth: { type: 'none' }
// });

// Example 5: Built-in tool (no auth needed, uses handler function)
// addTool('custom_builtin_tool', {
//   type: 'builtin',
//   category: 'utility',
//   namespace: 'custom',
//   displayName: '⚙️ Custom Tool',
//   description: 'Custom built-in tool',
//   routing_keywords: ['custom', 'utility', 'tool'],
//   examples: ['use custom tool', 'run custom function'],
//   handler: async (query, context) => {
//     // Your custom handler logic here
//     return { response: `Custom tool result for: ${query}` };
//   }
// });


const app = new Hono();

// Security headers middleware for Zoom Apps marketplace
function addSecurityHeaders(c, next) {
  // Essential CORS headers for Zoom Apps
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Zoom-App-Context, X-Zoom-App-Token');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  // Relaxed CSP for Zoom Apps marketplace
  c.header('Content-Security-Policy',
    "default-src 'self' https://*.zoom.us https://zoom.us https://app.zoom.us https://marketplace.zoom.us; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://esm.town https://code.iconify.design https://cdn.jsdelivr.net https://*.zoom.us https://zoom.us; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com https://*.zoom.us https://zoom.us; " +
    "img-src 'self' data: https: blob: https://*.zoom.us https://zoom.us; " +
    "font-src 'self' https://fonts.gstatic.com https://*.zoom.us https://zoom.us; " +
    "connect-src 'self' * wss: ws: https: http: data: https://*.zoom.us https://zoom.us https://api.zoom.us; " +
    "frame-src 'self' https://*.zoom.us https://zoom.us https://app.zoom.us; " +
    "frame-ancestors 'self' https://*.zoom.us https://zoom.us https://app.zoom.us https://marketplace.zoom.us https://*.zoomgov.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self' https://*.zoom.us https://zoom.us https://app.zoom.us"
  );

  // Remove restrictive frame options for Zoom Apps
  c.header('X-Frame-Options', 'ALLOWALL');

  // Other security headers
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '1; mode=block');

  return next();
}

// Handle preflight OPTIONS requests for CORS
app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Zoom-App-Context, X-Zoom-App-Token');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');
  return c.text('', 204);
});

// Apply security headers to all routes except WebSocket endpoints
app.use('*', (c, next) => {
  // Always skip headers on WS endpoints to avoid interfering with upgrades
  const path = c.req.path;
  if (path === '/ws' || path === '/ws-analysis') {
    return next();
  }
  // Skip security headers for WebSocket upgrade requests
  const upgradeHeader = c.req.header('Upgrade');
  const connectionHeader = c.req.header('Connection');
  const websocketKey = c.req.header('Sec-WebSocket-Key');
  const websocketVersion = c.req.header('Sec-WebSocket-Version');

  const isWebSocketUpgrade =
    (upgradeHeader === 'websocket') ||
    (connectionHeader && connectionHeader.toLowerCase().includes('upgrade')) ||
    (websocketKey && websocketVersion);

  if (isWebSocketUpgrade) {
    console.log('🔌 WebSocket upgrade request detected - skipping security headers');
    return next();
  }
  return addSecurityHeaders(c, next);
});

// RTMS data structures are now imported from websocket-utils.js
// Set up BroadcastChannel message handler
if (bc) {
  bc.onmessage = (ev) => {
    try {
      const msg = ev.data;
      if (!msg || msg.origin === INSTANCE_ID) return;
      if (msg.type === 'transcript') {
        for (const client of sseClients) {
          client.send('event: transcript\n' + 'data: ' + JSON.stringify(msg.payload) + '\n\n');
        }
      }
    } catch {}
  };
}

// Health check endpoint for Zoom Apps
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    zoom_app_ready: true
  });
});

// CORS test endpoint for Zoom Apps
app.get("/cors-test", (c) => {
  return c.json({
    message: "CORS is working! Zoom Apps can connect.",
    cors_headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "X-Zoom-App-Context,X-Zoom-App-Token"
    },
    zoom_domains_allowed: [
      "https://zoom.us",
      "https://*.zoom.us",
      "https://app.zoom.us",
      "https://marketplace.zoom.us"
    ]
  });
});

// Serve Alpine.js from local file
app.get("/@alpinejs@3.12.3.cdn.min.js", async (c) => {
  try {
    const alpineJs = await Deno.readTextFile("./alpinejs@3.12.3.cdn.min.js");
    return new Response(alpineJs, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Error reading Alpine.js file:', error);
    return c.text('Alpine.js file not found', 404);
  }
});

// Serve the minimal UI at root
app.get("/", async (c) => {
  try {
    let html = await Deno.readTextFile("./frontend/index.html");
    
    // Inject Tailwind config and styles
    const tailwindConfig = JSON.stringify(getTailwindConfig());
    const styles = getStyles();
    
    // Replace placeholders in HTML
    html = html.replace('{{TAILWIND_CONFIG}}', tailwindConfig);
    html = html.replace('{{STYLES}}', styles);
    
    return c.html(html);
  } catch (error) {
    console.error('Error reading HTML file:', error);
    return c.text('Error loading page', 500);
  }
});

// Crypto functions are now imported from crypto-utils.js


// RTMS Webhook endpoint
app.post(WEBHOOK_PATH, async (c) => {
  try {
    const body = await c.req.json();
    const { event, payload } = body;

    // Handle URL validation event
    if (event === 'endpoint.url_validation' && payload?.plainToken) {
      const hash = await createHmacSha256(ZOOM_SECRET_TOKEN, payload.plainToken);
      return c.json({
        plainToken: payload.plainToken,
        encryptedToken: hash,
      });
    }

    // Handle RTMS started event
    if (event === 'meeting.rtms_started') {
      const { meeting_uuid, rtms_stream_id, server_urls } = payload;
      console.log(`🚀 WEBHOOK: RTMS started - meeting: ${meeting_uuid.slice(0, 8)}..., stream: ${rtms_stream_id}, initiating signaling connection`);
      connectToSignalingWebSocket(meeting_uuid, rtms_stream_id, server_urls);
    }

    // Handle RTMS stopped event
    if (event === 'meeting.rtms_stopped') {
      const { meeting_uuid } = payload;
      if (activeConnections.has(meeting_uuid)) {
        const connections = activeConnections.get(meeting_uuid);
        for (const conn of Object.values(connections)) {
          if (conn && typeof conn.close === 'function') {
            conn.close();
          }
        }
        activeConnections.delete(meeting_uuid);
      }
    }

    return c.json({ status: 'Event received' });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// WebSocket functions are now imported from websocket-utils.js

// SSE endpoint for streaming transcripts to a minimal UI
app.get('/events', (c) => {
  console.log(`🔌 [SSE-ENDPOINT] New SSE client connecting`);
  let clientRef = null;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      clientRef = {
        send: (text) => controller.enqueue(encoder.encode(text)),
      };
      sseClients.add(clientRef);
      console.log(`✅ [SSE-ENDPOINT] Client added, total clients: ${sseClients.size}`);
      clientRef.send(': connected\n\n');
      console.log(`📤 [SSE-ENDPOINT] Sent connection confirmation`);
    },
    cancel() {
      if (clientRef) {
        sseClients.delete(clientRef);
        console.log(`🔌 [SSE-ENDPOINT] Client disconnected, remaining clients: ${sseClients.size}`);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      // Enhanced CORS headers for Zoom Apps
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Zoom-App-Context, X-Zoom-App-Token',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
});

// Handle OPTIONS requests for SSE endpoint
app.options('/events', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Zoom-App-Context, X-Zoom-App-Token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
});

// Polling endpoint for embedded environments that can't use SSE
let lastPollTimestamp = Date.now();

app.get('/api/poll-transcripts', (c) => {
  // Return transcripts added since last poll
  const since = parseInt(c.req.query('since')) || lastPollTimestamp;
  const recentTranscripts = getRecentTranscripts();
  const newTranscripts = recentTranscripts.filter(t => t.timestamp > since);
  
  lastPollTimestamp = Date.now();
  
  return c.json({
    transcripts: newTranscripts,
    timestamp: lastPollTimestamp,
    total_stored: recentTranscripts.length
  });
});

// Salesforce MCP Credential Management Endpoints
app.get('/api/salesforce/status', getSalesforceStatus);
app.get('/api/salesforce/oauth-url', getSalesforceOAuthUrl);
app.get('/salesforce/oauth/callback', handleSalesforceOAuthCallback);
app.post('/api/salesforce/credentials', setSalesforceCredentialsRoute);
app.delete('/api/salesforce/credentials', clearSalesforceCredentialsRoute);

// Salesforce Focus/Goal Management Endpoints
app.get('/api/salesforce/focus', (c) => {
  const userId = c.req.query('userId') || 'default';
  const focus = getSalesforceFocus(userId);
  
  return c.json({
    success: true,
    hasFocus: !!focus,
    focus: focus || null
  });
});

app.post('/api/salesforce/focus', async (c) => {
  try {
    const body = await c.req.json();
    const userId = body.userId || 'default';
    const naturalLanguageGoal = body.goal || body.description;
    
    if (!naturalLanguageGoal) {
      return c.json({
        success: false,
        error: 'Goal description is required'
      }, 400);
    }
    
    // Parse natural language goal into structured format
    const parsedGoal = parseFocusGoal(naturalLanguageGoal);
    
    // Allow override with explicit fields
    if (body.recordId) parsedGoal.recordId = body.recordId;
    if (body.recordType) parsedGoal.recordType = body.recordType;
    if (body.name) parsedGoal.name = body.name;
    if (body.context) parsedGoal.context = body.context;
    
    const result = setSalesforceFocus(userId, parsedGoal);
    
    return c.json(result);
  } catch (error) {
    console.error('Error setting Salesforce focus:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

app.delete('/api/salesforce/focus', (c) => {
  const userId = c.req.query('userId') || 'default';
  const result = clearSalesforceFocus(userId);
  
  return c.json(result);
});

app.get('/api/salesforce/focus/suggestions', async (c) => {
  try {
    // Get recent transcripts to analyze for suggestions
    const recentTranscripts = getRecentTranscripts();
    const suggestions = suggestFocusGoals(recentTranscripts);
    
    return c.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error generating focus suggestions:', error);
    return c.json({
      success: false,
      error: error.message,
      suggestions: []
    }, 500);
  }
});

// AI inference and routing functions are now imported from ai-inference.js
// Set built-in handlers in the tool registry
setBuiltinHandlers({
  getWeather,
  performWebSearch,
  answerDirectly
});

// Groq inference endpoint
app.post('/api/groq-inference', async (c) => {
  try {
    const body = await c.req.json();
    const { transcript, user_name, context, chat_history, salesforce_credentials } = body;

    // If Salesforce credentials are provided in the request, temporarily store them
    if (salesforce_credentials && salesforce_credentials.access_token && salesforce_credentials.instance_url) {
      setSalesforceCredentials('default', salesforce_credentials);
    }

    if (!transcript) {
      return c.json({ error: 'Transcript text required' }, 400);
    }

    if (!GROQ_API_KEY) {
    return c.json({
      detected: true,
      response: `Hello ${user_name || 'there'}! I detected your "Hey Groq" trigger, but the Groq API key is not configured. Please set GROQ_API_KEY environment variable.`,
      original_message: transcript,
      tools: []
    });
    }

    // Prepare chat history for the router (filter out system messages and limit to recent)
    const filteredChatHistory = (chat_history || [])
      .filter(msg => msg.user_id !== 'system' && msg.data)
      .slice(-10); // Keep last 10 messages for context

    const result = await performGroqInference(transcript, user_name, context, filteredChatHistory);

    // Include original message for frontend formatting
    result.original_message = transcript;

    return c.json(result);
  } catch (error) {
    console.error('Groq inference endpoint error:', error);
    return c.json({
      detected: false,
      response: 'Sorry, I encountered an error processing your request.',
      error: error.message,
      tools: [],
      original_message: transcript
    }, 500);
  }
});

// Request deduplication tracking
const recentRequests = new Map(); // transcript -> timestamp
const REQUEST_DEDUP_WINDOW_MS = 3000; // 3 seconds

// New trigger endpoint that processes Groq triggers from frontend
app.post('/api/trigger-groq', async (c) => {
  console.log(`\n${'█'.repeat(80)}`);
  console.log(`📨 /api/trigger-groq ENDPOINT HIT`);
  console.log(`${'█'.repeat(80)}\n`);
  
  try {
    const body = await c.req.json();
    console.log(`   📦 Request body received:`, {
      has_transcript: !!body.transcript,
      transcript_length: body.transcript?.length || 0,
      user_name: body.user_name,
      context: body.context,
      chat_history_length: body.chat_history?.length || 0,
      has_salesforce_credentials: !!body.salesforce_credentials
    });
    
    const { transcript, user_name, context, chat_history, user_id, timestamp, salesforce_credentials } = body;
    
    // Deduplication check: prevent processing same request within dedup window
    const requestKey = `${transcript.trim()}_${user_name}`;
    const now = Date.now();
    const lastRequestTime = recentRequests.get(requestKey);
    
    if (lastRequestTime && (now - lastRequestTime) < REQUEST_DEDUP_WINDOW_MS) {
      console.log(`   ⚠️ DUPLICATE REQUEST DETECTED - ignoring (last seen ${now - lastRequestTime}ms ago)`);
      console.log(`   Request key: ${requestKey.substring(0, 50)}...`);
      return c.json({
        success: true,
        detected: true,
        duplicate: true,
        message: 'Duplicate request ignored (already processing)'
      });
    }
    
    // Track this request
    recentRequests.set(requestKey, now);
    console.log(`   ✅ New request tracked (dedup key: ${requestKey.substring(0, 50)}...)`);
    
    // Clean up old entries (older than 10 seconds)
    for (const [key, time] of recentRequests.entries()) {
      if (now - time > 10000) {
        recentRequests.delete(key);
      }
    }

    // If Salesforce credentials are provided in the request, temporarily store them
    // This solves the Deno Deploy serverless issue where in-memory Map doesn't persist
    if (salesforce_credentials && salesforce_credentials.access_token && salesforce_credentials.instance_url) {
      console.log(`   🔐 Received Salesforce credentials in request body`);
      setSalesforceCredentials('default', salesforce_credentials);
      console.log(`   ✅ Temporarily stored credentials for this request`);
    }

    if (!transcript) {
      console.log(`   ❌ No transcript provided`);
      return c.json({ error: 'Transcript text required' }, 400);
    }

    console.log(`🎯 Processing: "${transcript?.slice(0, 40)}${transcript?.length > 40 ? '...' : ''}"`);

    // Prepare chat history for the router (filter out system messages and limit to recent)
    const filteredChatHistory = (chat_history || [])
      .filter(msg => msg.user_id !== 'system' && msg.data)
      .slice(-10); // Keep last 10 messages for context

    console.log(`   📋 Filtered chat history: ${filteredChatHistory.length} messages`);
    console.log(`   👤 User: ${user_name || 'Unknown'}`);
    console.log(`   📍 Context: ${context || 'meeting_transcript'}`);
    console.log(`\n   🚀 About to call performGroqInference...\n`);

    // Process the inference (skip trigger detection since frontend already validated)
    const result = await performGroqInference(transcript, user_name || 'Unknown', context || 'meeting_transcript', filteredChatHistory, true);

    // Create response transcript for SSE broadcast
    const responseTranscript = {
      user_id: 'groq-ai',
      user_name: 'Groq AI Assistant',
      data: result.response || 'I processed your request but couldn\'t generate a response.',
      timestamp: Date.now(),
      tools: result.tools || [],
      routing: result.routing || { reasoning: 'Direct routing', primaryIntent: 'general', confidence: 0.5 },
      original_message: transcript,
      citations: result.citations || []
    };

    // Store response transcript for polling endpoint
    addToRecentTranscripts(responseTranscript);

    // Try to broadcast through SSE first (works in single-instance environments)
    let sseBroadcastSuccess = false;
    for (const client of sseClients) {
      try {
        client.send('event: transcript\n' + 'data: ' + JSON.stringify({
          content: responseTranscript
        }) + '\n\n');
        sseBroadcastSuccess = true;
      } catch (broadcastError) {
        console.error('Error broadcasting to SSE client:', broadcastError);
      }
    }

    // In serverless environments, SSE clients may not be connected to this instance
    // Return the response transcript so frontend can add it directly
    if (!sseBroadcastSuccess || sseClients.size === 0) {
      return c.json({
        success: true,
        detected: true,
        tools_used: (result.tools || []).length,
        routing_decision: (result.routing || {}).reasoning,
        response_transcript: responseTranscript // Include the full transcript for frontend to add
      });
    }

    // Also broadcast a system message if there was an error
    if (result.error) {
      const errorTranscript = {
        user_id: 'system',
        user_name: 'Groq AI',
        data: `⚠️ Processing completed with error: ${result.error}`,
        timestamp: Date.now(),
        error: true
      };

      for (const client of sseClients) {
        try {
          client.send('event: transcript\n' + 'data: ' + JSON.stringify({
            content: errorTranscript
          }) + '\n\n');
        } catch (broadcastError) {
          console.error('Error broadcasting error to SSE client:', broadcastError);
        }
      }
    }

    return c.json({
      success: true,
      detected: result.detected,
      tools_used: result.tools?.length || 0,
      routing_decision: result.routing?.reasoning
    });

  } catch (error) {
    console.error('Trigger processing error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Discovery Mode endpoint - analyzes entire conversation for background insights
app.post('/api/discovery-analysis', async (c) => {
  try {
    const { transcripts, full_history } = await c.req.json();

    if (!transcripts || transcripts.length === 0) {
      return c.json({ insights: [] });
    }

    console.log(`🔮 Discovery Mode: Analyzing ${transcripts.length} transcripts...`);
    console.log(`🔮 Transcripts received:`, transcripts.map(t => `"${t.data?.substring(0, 50)}..."`));

    // Get today's date for context
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Build conversation context from transcripts
    // NOTE: Frontend sends transcripts in REVERSE order (newest first)
    // We need to reverse them so oldest is first, newest is last
    const allMessages = transcripts.slice(0, 20).reverse(); // Take up to 20 and reverse to chronological order
    
    // Smart segmentation: only mark as "current" if we have enough messages
    // Otherwise, just mark the VERY LAST message as newest
    let conversationSummary = '';
    
    if (allMessages.length > 3) {
      // Enough messages to split into past/current
      const recentMessages = allMessages.slice(-2); // Only last 2 are "current"
      const olderMessages = allMessages.slice(0, -2); // Everything else is "past"
      
      if (olderMessages.length > 0) {
        conversationSummary += '<past_conversation>\n';
        conversationSummary += olderMessages.map(t => `${t.user_name || 'User'}: ${t.data}`).join('\n');
        conversationSummary += '\n</past_conversation>\n\n';
      }
      
      conversationSummary += '<current_conversation>\n';
      conversationSummary += recentMessages.map((t, idx) => {
        const prefix = idx === recentMessages.length - 1 ? '[NEWEST] ' : '';
        return `${prefix}${t.user_name || 'User'}: ${t.data}`;
      }).join('\n');
      conversationSummary += '\n</current_conversation>';
    } else {
      // Very few messages - just mark the newest one
      conversationSummary += '<conversation>\n';
      conversationSummary += allMessages.map((t, idx) => {
        const prefix = idx === allMessages.length - 1 ? '[NEWEST] ' : '';
        return `${prefix}${t.user_name || 'User'}: ${t.data}`;
      }).join('\n');
      conversationSummary += '\n</conversation>';
    }

    console.log(`🔮 Conversation summary built:\n${conversationSummary}`);

    // Create discovery prompt for AI
    const discoveryPrompt = `You are a Discovery Mode AI assistant that proactively provides background information and insights during conversations.

TODAY'S DATE: ${today}

Analyze this conversation and determine if there are opportunities to provide helpful background information, context, or insights using available tools.

**CRITICAL INSTRUCTIONS**:
- Focus ONLY on the message marked [NEWEST] - this is the MOST RECENT message
- <past_conversation> is for context only - DO NOT answer old questions
- Only provide insights about topics in the [NEWEST] message
- Ignore any topics that were mentioned in older messages but NOT in the [NEWEST] one

Conversation History:
${conversationSummary}

Available tools:
- Weather: Get current weather conditions for mentioned locations
- Groq Compound (Web Search): FAST web search for current information about topics, companies, people, events, or trends. This uses groq/compound model which searches the web instantly. Use this for ANY web search needs.
- HuggingFace: Find AI models or datasets if AI/ML topics are discussed

**IMPORTANT**: 
- Discovery Mode does NOT have access to parallel_search (too slow/expensive)
- Use "groq_compound" for all web searches - it's much faster and perfect for quick discovery insights
- Keep insights short and relevant

Your task:
1. Look at the [NEWEST] message ONLY
2. Identify if that specific message mentions a topic that could benefit from additional context
3. Suggest 0-1 insight to discover (MAXIMUM 1!)

**CRITICAL RULES**:
- Suggest ONLY 1 insight maximum
- Focus EXCLUSIVELY on the [NEWEST] message
- Ignore all older messages - even if they seem related
- DO NOT suggest weather unless the [NEWEST] message explicitly asks about weather/temperature
- Only suggest an insight if it would genuinely add value

Don't suggest insights for:
- Topics from old messages (anything NOT marked [NEWEST])
- Questions that were already answered
- Topics already covered in previous discovery insights  
- Weather (unless [NEWEST] message explicitly asks "what's the weather")
- Trivial information
- Topics that don't need external context

Respond in JSON format:
{
  "should_discover": true/false,
  "insights": [
    {
      "topic": "what to discover",
      "reasoning": "why this would be valuable",
      "suggested_query": "specific query to use",
      "tool": "weather|groq_compound|huggingface"
    }
  ]
}`;

    const discoveryResponse = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-20b", // Using faster 20b model for quick analysis
      messages: [
        { role: "system", content: `You are a discovery analysis AI that identifies opportunities for providing helpful background information. Today's date is ${today}.` },
        { role: "user", content: discoveryPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const discoveryContent = discoveryResponse.choices[0]?.message?.content;
    console.log('🔮 Discovery analysis result:', discoveryContent);

    // Parse discovery decision
    let discoveryDecision;
    try {
      // Try to extract JSON from the response
      const jsonMatch = discoveryContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        discoveryDecision = JSON.parse(jsonMatch[0]);
      } else {
        discoveryDecision = { should_discover: false, insights: [] };
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse discovery decision, skipping:', parseError);
      return c.json({ insights: [] });
    }

    // If no insights to discover, return empty
    if (!discoveryDecision.should_discover || !discoveryDecision.insights || discoveryDecision.insights.length === 0) {
      console.log('ℹ️ No discovery insights needed');
      return c.json({ insights: [] });
    }

    // ENFORCE MAXIMUM 1 INSIGHT - take only the first one even if AI returns more
    const insights = discoveryDecision.insights.slice(0, 1);
    console.log(`🔮 Discovery returned ${discoveryDecision.insights.length} insights, processing only the first 1`);

    // Process each insight using the appropriate tool
    const processedInsights = [];
    
    for (const insight of insights) {
      try {
        console.log(`🔍 Discovering: ${insight.topic} using ${insight.tool}`);
        
        // Route through the same performGroqInference but with a BRIEF query instruction
        // Add explicit instruction to be brief since we'll distill further
        const discoveryQuery = `${insight.suggested_query}\n\nIMPORTANT: Provide a brief, factual answer in 2-3 sentences maximum. No tables or long explanations.`;
        const result = await performGroqInference(
          discoveryQuery,
          'Discovery Mode',
          'discovery_analysis',
          transcripts.slice(-10),
          true // Skip trigger detection
        );

        if (result.response) {
          // Re-process the raw findings as a background researcher
          console.log(`📝 Re-processing findings for background research presentation...`);
          
          const researcherPrompt = `Extract ONLY the single most important fact from this research about "${insight.topic}":

${result.response}

Rules:
- ONE sentence only
- Maximum 20 words
- Just the core fact, no context or explanation
- Ignore all tables, lists, and formatting
- If there are multiple facts, pick the MOST important one

Output format: [Single factual sentence]`;

          const researcherResponse = await groqClient.chat.completions.create({
            model: "openai/gpt-oss-20b", // Using faster 20b model for quick fact extraction
            messages: [
              { role: "system", content: `You are a fact extractor. Extract ONLY the single most important fact. Maximum 20 words. No preamble, no explanation, just the fact. Today's date is ${today}.` },
              { role: "user", content: researcherPrompt }
            ],
            temperature: 0.1,
            max_tokens: 50
          });

          const firstBriefing = researcherResponse.choices[0]?.message?.content || result.response;
          
          // SECOND PROCESSING STEP: Further distill to 1 sentence max
          console.log(`📝 Second distillation pass to ensure brevity...`);
          
          const finalDistillationPrompt = `Shorten this to ONE sentence, maximum 15 words:

"${firstBriefing}"

Remove any fluff. Keep only the core fact.`;

          const finalDistillationResponse = await groqClient.chat.completions.create({
            model: "openai/gpt-oss-20b", // Using faster 20b model - good enough for compression
            messages: [
              { role: "system", content: `You are a text compressor. Output ONLY 1 sentence, max 15 words. Today's date is ${today}.` },
              { role: "user", content: finalDistillationPrompt }
            ],
            temperature: 0.1,
            max_tokens: 30
          });

          const finalBriefing = finalDistillationResponse.choices[0]?.message?.content || firstBriefing;
          
          processedInsights.push({
            content: `### 🔮 ${insight.topic}\n\n${finalBriefing}`,
            tools: result.tools || [],
            routing: result.routing,
            citations: result.citations || []
          });
        }
      } catch (insightError) {
        console.error(`❌ Failed to process insight "${insight.topic}":`, insightError);
      }
    }

    console.log(`✅ Generated ${processedInsights.length} discovery insight(s)`);

    return c.json({
      success: true,
      insights: processedInsights
    });

  } catch (error) {
    console.error('❌ Discovery analysis error:', error);
    return c.json({
      success: false,
      error: error.message,
      insights: []
    }, 500);
  }
});

// Export app.fetch for Val Town, otherwise export app
export default (typeof Deno !== "undefined" && Deno.env.get("valtown")) ? app.fetch : app;


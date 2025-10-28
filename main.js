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
  bc,
  MODEL_DISCOVERY,
  MODEL_EXTRACTOR,
  MODEL_COMPRESSOR,
  isAIGeneratedMessage
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
  DiscoveryManager,
  evaluateDiscoveryNeed,
  formatDiscoverySummary
} from "./utils/discovery-cache-utils.js";
import {
  evaluateResponseNeed,
  ActionFeedManager,
  createActionFeedBroadcast
} from "./utils/heyzoom-decision-utils.js";

// Helper function to broadcast progress updates to SSE clients
function broadcastProgress(message, type = 'progress') {
  const progressTranscript = {
    user_id: 'zoom-ai',
    user_name: 'Zoom AI Assistant',
    data: message,
    timestamp: Date.now(),
    processing: true,
    type: type
  };
  
  // Broadcast to SSE clients
  for (const client of sseClients) {
    try {
      client.send('event: progress\n' + 'data: ' + JSON.stringify({
        content: progressTranscript
      }) + '\n\n');
    } catch (error) {
      console.error('Error broadcasting progress:', error);
    }
  }
  
  // Store for polling clients
  addToRecentTranscripts(progressTranscript);

  return progressTranscript;
}

// Helper function to broadcast custom events to SSE clients (for directives/scratchpad updates)
function broadcastEvent({ event, data }) {
  const eventData = {
    user_id: 'system',
    user_name: 'System',
    data: `🤖 AI updated ${event === 'directive-updated' ? 'Directives' : 'Scratch Pad'}`,
    timestamp: Date.now(),
    type: event,
    ...data
  };

  // Broadcast to SSE clients
  for (const client of sseClients) {
    try {
      client.send(`event: ${event}\n` + 'data: ' + JSON.stringify(data) + '\n\n');
    } catch (error) {
      console.error(`Error broadcasting ${event}:`, error);
    }
  }

  // Also add to action feed as a transcript
  const actionTranscript = {
    user_id: 'system',
    user_name: 'System',
    data: `🤖 AI updated ${event === 'directive-updated' ? 'Directives' : 'Scratch Pad'}`,
    timestamp: Date.now()
  };
  addToRecentTranscripts(actionTranscript);

  return eventData;
}
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
  setDirectives,
  getDirectives,
  clearDirectives
} from "./directives.js";
import {
  setScratchPad,
  getScratchPad,
  clearScratchPad
} from "./scratchpad.js";
// Import AI inference functions from agent-1 experiment
import {
  intelligentRouter,
  correctZoomSpelling,
  detectZoomTrigger,
  getWeather,
  performWebSearch,
  answerDirectly,
  performGroqInference
} from "./experiments/agent-1/agent-1-inference.js";

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

// Initialize Discovery Manager with cache and queue
const discoveryManager = new DiscoveryManager({
  cacheWindowMs: 30 * 60 * 1000, // 30 minutes
  similarityThreshold: 0.8,
  enableLogging: true
});

// Initialize Response Manager for Hey Zoom (reuses DiscoveryManager)
// Shorter cache window since responses are more contextual
const responseManager = new DiscoveryManager({
  cacheWindowMs: 15 * 60 * 1000, // 15 minutes
  similarityThreshold: 0.85,  // Slightly stricter matching
  enableLogging: true
});

// Initialize Action Feed Manager for router decisions
const actionFeedManager = new ActionFeedManager({
  enableLogging: true,
  maxMessages: 100
});

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

// Tool Registry API - Exposes the unified tool registry for frontend
app.get('/api/tools/registry', (c) => {
  // Build a simplified registry for frontend display purposes
  const simplifiedRegistry = {};
  
  for (const [toolId, tool] of Object.entries(UNIFIED_TOOL_REGISTRY)) {
    simplifiedRegistry[toolId] = {
      id: tool.id,
      displayName: tool.displayName,
      type: tool.type,
      category: tool.category,
      namespace: tool.namespace,
      description: tool.description,
      // For MCP tools, include server label for matching
      ...(tool.type === 'mcp' && {
        server_label: tool.server_label
      })
    };
  }
  
  return c.json({
    registry: simplifiedRegistry,
    timestamp: Date.now()
  });
});

// Discovery Status API - Shows cache and queue state
app.get('/api/discovery/status', (c) => {
  const summary = discoveryManager.getSummary();

  return c.json({
    cache: {
      count: summary.cache.count,
      items: summary.cache.items.map(item => ({
        topic: item.topic,
        age_seconds: Math.floor(item.ageMs / 1000),
        age_minutes: Math.floor(item.ageMs / 60000)
      }))
    },
    queue: {
      count: summary.queue.count,
      items: summary.queue.items.map(item => ({
        topic: item.topic,
        age_seconds: Math.floor(item.ageMs / 1000)
      }))
    },
    config: {
      cache_window_minutes: discoveryManager.cacheWindowMs / 60000,
      similarity_threshold: discoveryManager.similarityThreshold
    },
    timestamp: Date.now()
  });
});

// Clear Discovery Cache API - For debugging/testing
app.post('/api/discovery/clear-cache', (c) => {
  discoveryManager.clear();

  return c.json({
    success: true,
    message: 'Discovery cache and queue cleared',
    timestamp: Date.now()
  });
});

// Response Manager Status API - Shows Hey Zoom cache and queue state
app.get('/api/response/status', (c) => {
  const summary = responseManager.getSummary();

  return c.json({
    cache: {
      count: summary.cache.count,
      items: summary.cache.items.map(item => ({
        topic: item.topic,
        age_seconds: Math.floor(item.ageMs / 1000),
        age_minutes: Math.floor(item.ageMs / 60000)
      }))
    },
    queue: {
      count: summary.queue.count,
      items: summary.queue.items.map(item => ({
        topic: item.topic,
        age_seconds: Math.floor(item.ageMs / 1000)
      }))
    },
    config: {
      cache_window_minutes: responseManager.cacheWindowMs / 60000,
      similarity_threshold: responseManager.similarityThreshold
    },
    timestamp: Date.now()
  });
});

// Clear Response Cache API - For debugging/testing
app.post('/api/response/clear-cache', (c) => {
  responseManager.clear();

  return c.json({
    success: true,
    message: 'Response cache and queue cleared',
    timestamp: Date.now()
  });
});

// Action Feed API - Get recent router decisions
app.get('/api/action-feed', (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const decisions = actionFeedManager.getRecentDecisions(limit);

  return c.json({
    decisions,
    count: decisions.length,
    timestamp: Date.now()
  });
});

// Clear Action Feed API - For debugging/testing
app.post('/api/action-feed/clear', (c) => {
  actionFeedManager.clear();

  return c.json({
    success: true,
    message: 'Action feed cleared',
    timestamp: Date.now()
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

// Directives Management Endpoints
app.get('/api/directives', (c) => {
  const userId = c.req.query('userId') || 'default';
  const directive = getDirectives(userId);

  return c.json({
    success: true,
    hasDirective: !!directive,
    content: directive?.content || ''
  });
});

app.post('/api/directives', async (c) => {
  try {
    const body = await c.req.json();
    const userId = body.userId || 'default';
    const content = body.content;

    if (content === null || content === undefined) {
      return c.json({
        success: false,
        error: 'Content is required'
      }, 400);
    }

    const result = setDirectives(userId, content);

    return c.json(result);
  } catch (error) {
    console.error('Error setting directives:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

app.delete('/api/directives', (c) => {
  const userId = c.req.query('userId') || 'default';
  const result = clearDirectives(userId);

  return c.json(result);
});

// Scratch Pad Management Endpoints
app.get('/api/scratchpad', (c) => {
  const userId = c.req.query('userId') || 'default';
  const scratchPad = getScratchPad(userId);

  return c.json({
    success: true,
    hasScratchPad: !!scratchPad,
    content: scratchPad?.content || ''
  });
});

app.post('/api/scratchpad', async (c) => {
  try {
    const body = await c.req.json();
    const userId = body.userId || 'default';
    const content = body.content;

    if (content === null || content === undefined) {
      return c.json({
        success: false,
        error: 'Content is required'
      }, 400);
    }

    const result = setScratchPad(userId, content);

    return c.json(result);
  } catch (error) {
    console.error('Error setting scratch pad:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

app.delete('/api/scratchpad', (c) => {
  const userId = c.req.query('userId') || 'default';
  const result = clearScratchPad(userId);

  return c.json(result);
});

// AI inference and routing functions are now imported from ai-inference.js

// Tool handlers for Directives and Scratch Pad
/**
 * Update directives - can be called by AI or user
 * @param {string} newContent - New directive content (or transcript when called by router)
 * @param {Object|string} configOrUserId - Config object from router OR userId string
 * @returns {Object} - Success status and updated directive with displayable message
 */
async function updateDirectives(newContent, configOrUserId = 'default') {
  try {
    // Handle both signatures: (newContent, userId) OR (transcript, config)
    const userId = typeof configOrUserId === 'string' ? configOrUserId : 'default';

    const result = setDirectives(userId, newContent);

    // Broadcast update to frontend via SSE
    if (result.success) {
      broadcastEvent({
        event: 'directive-updated',
        data: {
          content: newContent,
          timestamp: Date.now(),
          updatedBy: 'ai'
        }
      });
    }

    // Return with displayable message for action feed (both 'response' for inference engine and 'message' for logs)
    const displayMessage = `📋 Updated directives:\n${newContent.substring(0, 150)}${newContent.length > 150 ? '...' : ''}`;
    return {
      ...result,
      response: displayMessage, // For inference engine display
      message: displayMessage   // For logging/debugging
    };
  } catch (error) {
    console.error('Error updating directives:', error);
    return {
      success: false,
      error: error.message,
      response: '❌ Failed to update directives',
      message: 'Failed to update directives'
    };
  }
}

/**
 * Update scratch pad - can be called by AI or user
 * @param {string} newContent - New scratch pad content (or transcript when called by router)
 * @param {Object|string} configOrUserId - Config object from router OR userId string
 * @returns {Object} - Success status and updated scratch pad with displayable message
 */
async function updateScratchPad(newContent, configOrUserId = 'default') {
  try {
    // Handle both signatures: (newContent, userId) OR (transcript, config)
    const userId = typeof configOrUserId === 'string' ? configOrUserId : 'default';

    const result = setScratchPad(userId, newContent);

    // Broadcast update to frontend via SSE
    if (result.success) {
      broadcastEvent({
        event: 'scratchpad-updated',
        data: {
          content: newContent,
          timestamp: Date.now(),
          updatedBy: 'ai'
        }
      });
    }

    // Return with displayable message for action feed (both 'response' for inference engine and 'message' for logs)
    const displayMessage = `📝 Updated scratch pad:\n${newContent.substring(0, 150)}${newContent.length > 150 ? '...' : ''}`;
    return {
      ...result,
      response: displayMessage, // For inference engine display
      message: displayMessage   // For logging/debugging
    };
  } catch (error) {
    console.error('Error updating scratch pad:', error);
    return {
      success: false,
      error: error.message,
      response: '❌ Failed to update scratch pad',
      message: 'Failed to update scratch pad'
    };
  }
}

// Set built-in handlers in the tool registry
setBuiltinHandlers({
  getWeather,
  performWebSearch,
  answerDirectly,
  updateDirectives,
  updateScratchPad
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
      .filter(msg =>
        msg.user_id !== 'system' &&
        msg.user_id !== 'zoom-ai-router' &&  // Exclude router decision messages
        msg.data
      )
      .slice(-10); // Keep last 10 messages for context

    // Pass request headers for bearer token passthrough
    const result = await performGroqInference(
      transcript, 
      user_name, 
      context, 
      filteredChatHistory,
      false, // Don't skip trigger detection
      null, // No progress callback
      c.req.raw.headers // Pass headers for bearer token auth
    );

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

// Discovery deduplication tracking
const recentDiscoveryRequests = new Map(); // conversationKey -> timestamp
const DISCOVERY_DEDUP_WINDOW_MS = 60000; // 60 seconds - prevent repeated discovery on same conversation state

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
      user_id: body.user_id,
      context: body.context,
      chat_history_length: body.chat_history?.length || 0,
      has_salesforce_credentials: !!body.salesforce_credentials
    });
    
    const {
      transcript,
      user_name,
      context,
      chat_history,
      user_id,
      timestamp,
      salesforce_credentials,
      hey_zoom_strategy = 'reluctant'  // Strategy for Hey Zoom responses
    } = body;
    
    // CRITICAL SAFETY CHECK: Reject AI-generated messages immediately
    // This prevents feedback loops where AI messages trigger new AI responses
    if (isAIGeneratedMessage(user_id, user_name)) {
      console.log(`   🚫 BLOCKED: AI message (preventing feedback loop)`, {
        user_id,
        user_name,
        transcript_preview: transcript?.substring(0, 100)
      });
      // Return a response that looks like a normal "no detection" to frontend
      // This prevents "Failed to process" errors while silently blocking the message
      return c.json({
        success: true,
        detected: false,
        response: null,
        message: '',  // Empty message - nothing to show
        tools: [],
        routing: { reasoning: 'AI message blocked', primaryIntent: 'system', confidence: 1.0 }
      });
    }
    
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
      .filter(msg =>
        msg.user_id !== 'system' &&
        msg.user_id !== 'zoom-ai-router' &&  // Exclude router decision messages
        msg.data
      )
      .slice(-10); // Keep last 10 messages for context

    console.log(`   📋 Filtered chat history: ${filteredChatHistory.length} messages`);
    console.log(`   👤 User: ${user_name || 'Unknown'}`);
    console.log(`   📍 Context: ${context || 'meeting_transcript'}`);

    // Check for Hey Zoom enabled flag (from request body or default to false)
    const heyZoomEnabled = body.hey_zoom_enabled || false;
    console.log(`   🎛️ Hey Zoom Toggle: ${heyZoomEnabled ? 'ON (bypass decision agent)' : 'OFF (use decision agent)'}`);

    // Evaluate whether to respond using decision agent
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤔 EVALUATING RESPONSE NEED`);
    console.log(`${'='.repeat(80)}\n`);

    const chatHistoryForDecision = filteredChatHistory.map(msg => ({
      role: msg.user_id === 'zoom-ai' ? 'assistant' : 'user',
      content: `${msg.user_name || 'User'}: ${msg.data}`
    }));

    const responseDecision = await evaluateResponseNeed(groqClient, {
      transcript,
      chatHistory: chatHistoryForDecision,
      responseManager,
      heyZoomEnabled,
      strategy: hey_zoom_strategy,
      model: MODEL_DISCOVERY
    });

    console.log(`\n📋 Response Decision:`);
    console.log(`   Should Respond: ${responseDecision.shouldRespond ? 'YES ✅' : 'NO ⏭️'}`);
    console.log(`   Reasoning: ${responseDecision.reasoning}`);
    console.log(`   Confidence: ${responseDecision.confidence}`);
    console.log(`   Cached: ${responseDecision.cached}`);
    console.log(`   Queued: ${responseDecision.queued}`);
    console.log(`   Bypassed Decision Agent: ${responseDecision.bypassedDecisionAgent || false}`);
    console.log(`${'='.repeat(80)}\n`);

    // Add decision to action feed
    const actionFeedMessage = actionFeedManager.addRouterDecision({
      shouldRespond: responseDecision.shouldRespond,
      reasoning: responseDecision.reasoning,
      confidence: responseDecision.confidence,
      transcript,
      cached: responseDecision.cached,
      queued: responseDecision.queued
    });

    // Broadcast router decision to action feed
    // Pass the original message timestamp so decision appears right after it chronologically
    const decisionBroadcast = createActionFeedBroadcast(responseDecision, transcript, timestamp);
    addToRecentTranscripts(decisionBroadcast);

    // Broadcast to SSE clients
    for (const client of sseClients) {
      try {
        client.send('event: transcript\n' + 'data: ' + JSON.stringify({
          content: decisionBroadcast
        }) + '\n\n');
      } catch (error) {
        console.error('Error broadcasting router decision:', error);
      }
    }

    // If decision is to NOT respond, return early with a silent response
    if (!responseDecision.shouldRespond) {
      console.log(`⏭️ Skipping response based on decision agent`);
      return c.json({
        success: true,
        detected: false,  // Changed to false so frontend knows not to show as response
        skipped: true,
        response: null,  // Explicitly null so frontend doesn't wait
        decision: responseDecision,
        message: responseDecision.reasoning,
        reasoning: responseDecision.reasoning
      });
    }

    // Add to queue before processing
    const queueId = responseManager.addToQueue(transcript);

    console.log(`\n   🚀 About to call performGroqInference...\n`);

    // Process the inference (skip trigger detection since frontend already validated)
    // Pass progress callback to broadcast status updates
    // Pass request headers for bearer token passthrough
    let result;
    try {
      result = await performGroqInference(
        transcript,
        user_name || 'Unknown',
        context || 'meeting_transcript',
        filteredChatHistory,
        true,
        broadcastProgress, // Pass the progress callback
        c.req.raw.headers // Pass request headers for bearer token auth
      );

      // Cache the response
      responseManager.cacheDiscovery(transcript, {
        result,
        timestamp: Date.now()
      });
    } finally {
      // Always remove from queue
      responseManager.removeFromQueue(queueId);
    }

    // Create response transcript for SSE broadcast
    const responseTranscript = {
      user_id: 'zoom-ai',
      user_name: 'Zoom AI Assistant',
      data: result.response || 'I processed your request but couldn\'t generate a response.',
      timestamp: Date.now(),
      tools: result.tools || [],
      routing: result.routing || { reasoning: 'Direct routing', primaryIntent: 'general', confidence: 0.5 },
      original_message: transcript,
      citations: result.citations || [],
      // Include scratchpad/directives so frontend can update UI
      scratchpad: result.scratchpad || null,
      directives: result.directives || null
    };

    // Store response transcript for polling endpoint
    addToRecentTranscripts(responseTranscript);

    // Try to broadcast through SSE first (works in single-instance environments)
    let sseBroadcastSuccess = false;
    let sseClientCount = sseClients.size;
    const broadcastTimestamp = new Date().toISOString();
    
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📡 [SSE BROADCAST ${broadcastTimestamp}]`);
    console.log(`   Client count: ${sseClientCount}`);
    console.log(`   Response preview: "${responseTranscript.data?.substring(0, 100)}..."`);
    console.log(`   Original message: "${responseTranscript.original_message?.substring(0, 50)}..."`);
    console.log(`${'─'.repeat(80)}`);
    
    let successfulBroadcasts = 0;
    let failedBroadcasts = 0;
    
    for (const client of sseClients) {
      try {
        const eventData = 'event: transcript\n' + 'data: ' + JSON.stringify({
          content: responseTranscript
        }) + '\n\n';
        
        client.send(eventData);
        sseBroadcastSuccess = true;
        successfulBroadcasts++;
        console.log(`✅ [SSE] Broadcast #${successfulBroadcasts} sent successfully`);
      } catch (broadcastError) {
        failedBroadcasts++;
        console.error(`❌ [SSE] Broadcast failed (#${failedBroadcasts}):`, broadcastError.message);
        console.error(`   Error details:`, broadcastError);
      }
    }
    
    console.log(`📊 [SSE] Broadcast summary: ${successfulBroadcasts} successful, ${failedBroadcasts} failed`);
    console.log(`${'─'.repeat(80)}\n`);

    // Also broadcast a system message if there was an error
    if (result.error) {
      const errorTranscript = {
        user_id: 'system',
        user_name: 'Zoom AI',
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

    // CRITICAL FIX: ALWAYS include response_transcript in HTTP response
    // Even if SSE broadcast succeeds, the frontend needs this as a guaranteed fallback
    // because SSE delivery can be unreliable (connection issues, timing problems, etc.)
    // The frontend will prefer SSE delivery but will use this if SSE doesn't arrive
    console.log(`📤 Response strategy: Always including response_transcript as guaranteed fallback (SSE clients: ${sseClientCount}, broadcast attempted: ${sseBroadcastSuccess})`);

    return c.json({
      success: true,
      detected: result.detected,
      tools_used: result.tools?.length || 0,
      routing_decision: result.routing?.reasoning,
      // ALWAYS include response_transcript - frontend will use it if SSE fails/delays
      response_transcript: responseTranscript,
      sse_broadcast_attempted: sseBroadcastSuccess,
      sse_client_count: sseClientCount
    });

  } catch (error) {
    console.error('Trigger processing error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Direct SSE/Message endpoint for API clients (supports bearer token auth)
// Example: curl -X POST https://your-server.com/sse/message \
//   -H "Authorization: Bearer YOUR_SALESFORCE_TOKEN" \
//   -H "X-Salesforce-Instance-Url: https://yourinstance.salesforce.com" \
//   -H "Content-Type: application/json" \
//   -d '{"method":"tools/call","params":{"name":"sf_search_leads","arguments":{"company":"Acme"}}}'
app.post('/sse/message', async (c) => {
  try {
    const body = await c.req.json();
    console.log(`\n${'█'.repeat(80)}`);
    console.log(`📨 /sse/message ENDPOINT HIT (Bearer Token Auth)`);
    console.log(`${'█'.repeat(80)}\n`);
    
    // Extract authorization header
    const authHeader = c.req.header('Authorization');
    const instanceUrl = c.req.header('X-Salesforce-Instance-Url');
    
    console.log(`   🔐 Authorization header present: ${!!authHeader}`);
    console.log(`   🏢 Instance URL: ${instanceUrl || 'not provided'}`);
    
    // Validate bearer token auth for Salesforce
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Missing or invalid Authorization header. Expected: Bearer YOUR_TOKEN'
      }, 401);
    }
    
    if (!instanceUrl) {
      return c.json({
        success: false,
        error: 'Missing X-Salesforce-Instance-Url header'
      }, 400);
    }
    
    // Parse MCP request format
    const { method, params } = body;
    
    if (method !== 'tools/call') {
      return c.json({
        success: false,
        error: `Unsupported method: ${method}. Expected: tools/call`
      }, 400);
    }
    
    if (!params || !params.name) {
      return c.json({
        success: false,
        error: 'Missing params.name in request body'
      }, 400);
    }
    
    const toolName = params.name;
    const toolArgs = params.arguments || {};
    
    console.log(`   🔧 Tool: ${toolName}`);
    console.log(`   📋 Arguments:`, toolArgs);
    
    // Convert MCP request to a natural language query for the AI
    let naturalQuery = `Hey Groq, `;
    
    if (toolName === 'sf_search_leads') {
      const { company, name, status, limit } = toolArgs;
      const parts = [];
      if (company) parts.push(`in company "${company}"`);
      if (name) parts.push(`named "${name}"`);
      if (status) parts.push(`with status "${status}"`);
      if (limit) parts.push(`limit ${limit}`);
      naturalQuery += `search for leads ${parts.join(' ')}`;
    } else if (toolName === 'sf_create_lead') {
      const { first_name, last_name, company } = toolArgs;
      naturalQuery += `create a new lead for ${first_name} ${last_name} at ${company}`;
    } else if (toolName === 'sf_run_soql_query') {
      naturalQuery += `run SOQL query: ${toolArgs.query}`;
    } else {
      // Generic query for other tools
      naturalQuery += `call ${toolName} with ${JSON.stringify(toolArgs)}`;
    }
    
    console.log(`   🗣️ Natural query: "${naturalQuery}"`);
    
    // Process with performGroqInference, passing request headers for bearer token auth
    const result = await performGroqInference(
      naturalQuery,
      'API Client',
      'api_request',
      [], // No chat history for direct API calls
      true, // Skip trigger detection
      null, // No progress callback
      c.req.raw.headers // Pass headers for bearer token auth
    );
    
    console.log(`   ✅ Inference completed`);
    
    return c.json({
      success: true,
      method: method,
      tool: toolName,
      response: result.response,
      tools: result.tools || [],
      routing: result.routing || {}
    });
    
  } catch (error) {
    console.error('❌ /sse/message error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Discovery Mode endpoint - analyzes entire conversation for background insights
app.post('/api/discovery-analysis', async (c) => {
  try {
    const {
      transcripts,
      full_history,
      discovery_strategy = 'reluctant'  // Strategy for Discovery Feed
    } = await c.req.json();

    if (!transcripts || transcripts.length === 0) {
      return c.json({ insights: [] });
    }

    console.log(`🔮 Discovery Mode: Analyzing ${transcripts.length} transcripts...`);
    // Log first 3 transcripts with full content for debugging
    console.log(`🔮 Latest transcripts (full):`, transcripts.slice(0, 3).map((t, i) =>
      `[${i}] ${t.user_name || 'User'}: "${t.data}"`
    ).join('\n   '));

    // Show current cache and queue status
    console.log(`\n${formatDiscoverySummary(discoveryManager)}`);

    // Get latest message
    const latestMessage = transcripts[0]?.data || '';
    const latestUserId = transcripts[0]?.user_id || '';
    const latestUserName = transcripts[0]?.user_name || '';

    // SAFETY CHECK: Don't run discovery on discovery-generated content (prevents feedback loop)
    if (latestUserId === 'discovery-ai' || latestUserName === 'Discovery Mode' || latestUserName === 'Discovery') {
      console.log(`⏭️ BLOCKED: Discovery Mode attempted to run on its own output (preventing feedback loop)`);
      console.log(`   User ID: ${latestUserId}, User Name: ${latestUserName}`);
      return c.json({
        insights: [],
        cache_summary: discoveryManager.getSummary(),
        blocked: true,
        reason: 'Discovery cannot run on its own output'
      });
    }

    // DEDUPLICATION CHECK: Use ALL user messages to create conversation state key
    // This ensures we only analyze each unique conversation state once
    const userMessages = transcripts
      .map(t => t.data?.trim())
      .filter(Boolean)
      .join('||'); // Use || as separator to create unique key

    const discoveryKey = userMessages;
    const now = Date.now();
    const lastDiscoveryTime = recentDiscoveryRequests.get(discoveryKey);

    if (lastDiscoveryTime && (now - lastDiscoveryTime) < DISCOVERY_DEDUP_WINDOW_MS) {
      console.log(`   ⏭️ SKIP: Already analyzed this conversation state ${Math.round((now - lastDiscoveryTime) / 1000)}s ago`);
      console.log(`   Conversation has ${transcripts.length} messages, no new user input since last analysis`);
      return c.json({
        insights: [],
        cache_summary: discoveryManager.getSummary(),
        duplicate: true,
        reason: 'Already analyzed this conversation state'
      });
    }

    // Track this discovery request with the full conversation state
    recentDiscoveryRequests.set(discoveryKey, now);
    console.log(`   ✅ New conversation state detected - running discovery analysis`);
    console.log(`   Conversation state: ${transcripts.length} user messages`);

    // Clean up old entries (older than 90 seconds)
    for (const [key, time] of recentDiscoveryRequests.entries()) {
      if (now - time > 90000) {
        recentDiscoveryRequests.delete(key);
      }
    }

    // Build chat history for context - use MORE messages for better context
    // Take up to 50 messages (was 20) to give discovery full conversation view
    const chatHistory = transcripts
      .filter(t =>
        t.user_id !== 'system' &&
        t.user_id !== 'zoom-ai-router' &&  // Exclude router decision messages
        t.data
      )
      .slice(0, 50)
      .reverse()
      .map(t => ({
        role: 'user',
        content: `${t.user_name || 'User'}: ${t.data}`
      }));

    // Use cache-aware discovery evaluation
    console.log(`🤔 Evaluating discovery need with cache/queue awareness...`);
    const decision = await evaluateDiscoveryNeed(groqClient, {
      transcript: latestMessage,
      chatHistory,
      discoveryManager,
      strategy: discovery_strategy,
      model: MODEL_DISCOVERY
    });

    console.log(`📋 Discovery decision:`, {
      should_discover: decision.should_discover,
      insights_count: decision.insights.length,
      skipped_count: decision.skipped.length,
      reasoning: decision.reasoning
    });

    // Log skipped insights
    if (decision.skipped.length > 0) {
      console.log(`⏭️ Skipped ${decision.skipped.length} insights (already cached/queued):`);
      decision.skipped.forEach(s => console.log(`   - "${s.topic}" (${s.reason})`));
    }

    // If no insights to discover, return the decision info for UI display
    if (!decision.should_discover || decision.insights.length === 0) {
      console.log('ℹ️ No discovery insights needed');

      // Create a "skipped" insight to show in the feed
      const skippedInsights = [];

      // Add overall decision as a skipped item
      if (decision.reasoning) {
        skippedInsights.push({
          type: 'decision',
          content: `**Skipped:** ${decision.reasoning}`,
          timestamp: Date.now(),
          skipped: true,
          reasoning: decision.reasoning
        });
      }

      // Add any explicitly skipped topics (cached/queued)
      if (decision.skipped && decision.skipped.length > 0) {
        decision.skipped.forEach(skippedItem => {
          const reasonText = skippedItem.reason === 'already_cached'
            ? 'Already researched recently'
            : 'Currently being researched';
          skippedInsights.push({
            type: 'skipped_topic',
            content: `**Skipped:** ${skippedItem.topic} — ${reasonText}`,
            timestamp: Date.now(),
            skipped: true,
            topic: skippedItem.topic,
            reason: skippedItem.reason
          });
        });
      }

      return c.json({
        insights: skippedInsights,
        cache_summary: discoveryManager.getSummary()
      });
    }

    // ENFORCE MAXIMUM 1 INSIGHT - take only the first one
    const insights = decision.insights.slice(0, 1);
    console.log(`🔮 Processing ${insights.length} insight(s)`);

    // Get today's date for context
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Process each insight using the appropriate tool
    const processedInsights = [];
    const queueIds = []; // Track queue IDs for cleanup

    for (const insight of insights) {
      let queueId = null;

      try {
        // Add to queue before processing
        queueId = discoveryManager.addToQueue(insight.topic);
        queueIds.push(queueId);

        console.log(`🔍 Discovering: ${insight.topic} using ${insight.tool}`);

        // Route through the same performGroqInference but with a BRIEF query instruction
        // Add explicit instruction to be brief since we'll distill further
        const discoveryQuery = `${insight.suggested_query}\n\nIMPORTANT: Provide a brief, factual answer in 2-3 sentences maximum. No tables or long explanations.`;
        const result = await performGroqInference(
          discoveryQuery,
          'Discovery Mode',
          'discovery_analysis',
          transcripts.slice(-10),
          true, // Skip trigger detection
          null, // No progress callback
          null, // No request headers
          true  // Skip discovery (prevents recursive feedback loop)
        );

        if (result.response) {
          // REFLECTION STEP: Evaluate if the result adds value to the conversation
          console.log(`🤔 Reflecting: Does this information add value?`);

          const reflectionPrompt = `You are evaluating whether research results add value to a conversation.

Conversation context (last 10 messages):
${transcripts.slice(-10).map(t => `${t.user_name || 'User'}: ${t.data}`).join('\n')}

Research topic: "${insight.topic}"
Research result:
${result.response}

Question: Does this research result add VALUE to the conversation?

Consider:
- Does it answer a question being asked?
- Does it provide useful context for the discussion?
- Is it interesting and relevant to what's being discussed?
- Would users find this information helpful or engaging?

DO NOT show if:
- Information is generic or obvious
- Not relevant to the current discussion
- Doesn't answer any questions or add context
- Would be noise rather than signal

Respond with JSON:
{
  "adds_value": false,  // true only if this genuinely enriches the conversation
  "reasoning": "Brief explanation of why this does or doesn't add value"
}`;

          const reflectionResponse = await groqClient.chat.completions.create({
            model: MODEL_DISCOVERY,
            messages: [
              { role: "system", content: `You are a conversation value evaluator. Be selective - only approve information that genuinely adds value. Default to false unless clearly valuable.` },
              { role: "user", content: reflectionPrompt }
            ],
            temperature: 0.1,
            max_tokens: 200
          });

          const reflectionContent = reflectionResponse.choices[0]?.message?.content;
          let reflection;
          try {
            const jsonMatch = reflectionContent.match(/\{[\s\S]*\}/);
            reflection = jsonMatch ? JSON.parse(jsonMatch[0]) : { adds_value: true, reasoning: 'Parse error - defaulting to show' };
          } catch (e) {
            console.warn('⚠️ Failed to parse reflection:', e);
            reflection = { adds_value: true, reasoning: 'Parse error - defaulting to show' };
          }

          console.log(`🔍 Reflection result: ${reflection.adds_value ? 'SHOW ✅' : 'SKIP ⏭️'}`);
          console.log(`   Reasoning: ${reflection.reasoning}`);

          // If reflection says this doesn't add value, skip it
          if (!reflection.adds_value) {
            console.log(`⏭️ Skipping "${insight.topic}" - doesn't add sufficient value`);

            // Remove from queue
            if (queueId) {
              discoveryManager.removeFromQueue(queueId);
            }

            continue; // Skip to next insight
          }

          // Re-process the raw findings as a background researcher
          console.log(`📝 Processing findings for background research...`);

          // Extract concise context paragraph
          const contextPrompt = `Provide a brief, engaging summary about "${insight.topic}" from this research:

${result.response}

Rules:
- 2-3 sentences total
- Maximum 75 words
- Include relevant details, numbers, context
- Make it informative but concise
- No preamble or introduction
- Start directly with the information

Output format: [2-3 sentence paragraph]`;

          const contextResponse = await groqClient.chat.completions.create({
            model: MODEL_EXTRACTOR,
            messages: [
              { role: "system", content: `You are a background researcher. Provide brief, informative context paragraphs. 2-3 sentences, max 75 words. Today's date is ${today}.` },
              { role: "user", content: contextPrompt }
            ],
            temperature: 0.1,
            max_tokens: 500 // Increased from 300 to ensure we don't truncate
          });

          let contextParagraph = contextResponse.choices[0]?.message?.content || result.response;

          // DEBUG: Log the extraction
          console.log(`📝 Context extraction:`);
          console.log(`   Raw response length: ${result.response?.length || 0} chars`);
          console.log(`   Extracted length: ${contextParagraph?.length || 0} chars`);
          console.log(`   Extracted content: "${contextParagraph?.substring(0, 200)}..."`);

          // Check if extraction was truncated or too short - use raw response instead
          if (!contextParagraph || contextParagraph.length < 50 || !contextParagraph.trim().endsWith('.')) {
            console.warn(`⚠️ Context extraction seems truncated or incomplete, using raw response instead`);
            // Fall back to first 300 chars of raw response if extraction failed
            contextParagraph = result.response.substring(0, 300).trim();
            // Add ellipsis if truncated
            if (result.response.length > 300) {
              contextParagraph += '...';
            }
            console.log(`   Using fallback (${contextParagraph.length} chars): "${contextParagraph}"`);
          }

          // Just show the context paragraph with topic header
          const formattedContent = `### 🔮 ${insight.topic}\n\n${contextParagraph}`;

          const processedInsight = {
            type: 'discovered',
            content: formattedContent,
            tools: result.tools || [],
            routing: result.routing,
            citations: result.citations || [],
            context: contextParagraph,
            topic: insight.topic,
            skipped: false,
            timestamp: Date.now()
          };

          processedInsights.push(processedInsight);

          // Cache the result
          discoveryManager.cacheDiscovery(insight.topic, {
            insight,
            processed: processedInsight,
            timestamp: Date.now()
          });
        }

        // Remove from queue after processing
        if (queueId) {
          discoveryManager.removeFromQueue(queueId);
        }

      } catch (insightError) {
        console.error(`❌ Failed to process insight "${insight.topic}":`, insightError);

        // Remove from queue on error
        if (queueId) {
          discoveryManager.removeFromQueue(queueId);
        }
      }
    }

    console.log(`✅ Generated ${processedInsights.length} discovery insight(s)`);
    console.log(`\n${formatDiscoverySummary(discoveryManager)}`);

    // Add skipped insights to response for transparency
    const skippedInsights = [];
    if (decision.skipped && decision.skipped.length > 0) {
      decision.skipped.forEach(skippedItem => {
        const reasonText = skippedItem.reason === 'already_cached'
          ? 'Already researched recently'
          : 'Currently being researched';
        skippedInsights.push({
          type: 'skipped_topic',
          content: `**Skipped:** ${skippedItem.topic} — ${reasonText}`,
          timestamp: Date.now(),
          skipped: true,
          topic: skippedItem.topic,
          reason: skippedItem.reason
        });
      });
    }

    // Combine processed and skipped insights
    const allInsights = [...processedInsights, ...skippedInsights];

    return c.json({
      success: true,
      insights: allInsights,
      discovered_count: processedInsights.length,
      skipped_count: skippedInsights.length,
      cache_summary: discoveryManager.getSummary()
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


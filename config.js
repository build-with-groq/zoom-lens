/**
 * Configuration and Constants
 * Central configuration file for environment variables and app constants
 */

import "jsr:@std/dotenv/load"; // needed for deno run; not req for smallweb or valtown
import OpenAI from "npm:openai@4.52.7";

// Zoom RTMS configuration
export const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID");
export const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET");
export const ZOOM_SECRET_TOKEN = Deno.env.get("ZOOM_SECRET_TOKEN");
export const WEBHOOK_PATH = Deno.env.get("WEBHOOK_PATH") || "/webhook";

// Groq API configuration
export const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
export const groqClient = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Salesforce MCP configuration
export const SALESFORCE_MCP_URL = Deno.env.get("SALESFORCE_MCP_URL");
console.log(`🔧 Salesforce MCP URL: ${SALESFORCE_MCP_URL || 'NOT SET - Please set SALESFORCE_MCP_URL in .env'}`);

// Cross-isolate relay for Deno Deploy: broadcast transcripts to all isolates
export const INSTANCE_ID = (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);
export const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('rtms-transcripts') : null;


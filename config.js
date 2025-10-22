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

// AI Model configuration - centralized model selection with env variable overrides
export const MODEL_ROUTER = Deno.env.get("MODEL_ROUTER") || "openai/gpt-oss-20b"; // Intelligent routing decisions
// export const MODEL_ROUTER = Deno.env.get("MODEL_ROUTER") || "llama-3.1-8b-instant"; // Intelligent routing decisions

export const MODEL_DISCOVERY = Deno.env.get("MODEL_DISCOVERY") || "openai/gpt-oss-120b"; // Discovery analysis
// export const MODEL_DISCOVERY = Deno.env.get("MODEL_DISCOVERY") || "llama-3.1-8b-instant"; // Discovery analysis

export const MODEL_EXTRACTOR = Deno.env.get("MODEL_EXTRACTOR") || "openai/gpt-oss-120b"; // Fact extraction and distillation
export const MODEL_COMPRESSOR = Deno.env.get("MODEL_COMPRESSOR") || "openai/gpt-oss-20b"; // Text compression
export const MODEL_INFERENCE = Deno.env.get("MODEL_INFERENCE") || "openai/gpt-oss-120b"; // Main inference with MCP tools
// export const MODEL_INFERENCE = Deno.env.get("MODEL_INFERENCE") || "openai/gpt-oss-20b"; // Main inference with MCP tools

// export const MODEL_DIRECT_ANSWER = Deno.env.get("MODEL_DIRECT_ANSWER") || "openai/gpt-oss-120b"; // Direct answers without tools
export const MODEL_DIRECT_ANSWER = Deno.env.get("MODEL_DIRECT_ANSWER") || "llama-3.1-8b-instant"; // Direct answers without tools

export const MODEL_SYNTHESIS = Deno.env.get("MODEL_SYNTHESIS") || "openai/gpt-oss-120b"; // Multi-tool response synthesis
// export const MODEL_SYNTHESIS = Deno.env.get("MODEL_SYNTHESIS") || "llama-3.1-8b-instant"; // Multi-tool response synthesis

// Router retry configuration - race-based retry system for handling slow router responses
export const ROUTER_RETRY_DELAY_MS = parseInt(Deno.env.get("ROUTER_RETRY_DELAY_MS") || "3500"); // Default 3.5 seconds

// Cross-isolate relay for Deno Deploy: broadcast transcripts to all isolates
export const INSTANCE_ID = (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);
export const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('rtms-transcripts') : null;


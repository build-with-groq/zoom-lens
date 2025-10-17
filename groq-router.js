/**
 * GROQ ROUTER
 * 
 * AI-powered intelligent routing and inference logic
 * This module handles tool selection, parameter extraction, and Groq API calls
 */

import { getAvailableTools } from "./tool-registry-unified.js";

// Groq client will be injected from main.js
let groqClient = null;
let SALESFORCE_MCP_URL = null;

// Initialize with groq client and config
export function initializeRouter(client, config) {
  groqClient = client;
  SALESFORCE_MCP_URL = config.SALESFORCE_MCP_URL;
}

// Enhanced AI-powered router that decides which tools and specific MCP functions to use
export async function intelligentRouter(question, userName, context = {}, chatHistory = []) {
  try {
    // Get routing information from unified registry
    const availableTools = getAvailableTools();

    console.log(`🔍 ROUTING: Analyzing question: "${question}" from user: ${userName}`);

    // Prepare chat history context (last 5 messages for context)
    const recentHistory = chatHistory.slice(-5).map(msg => ({
      role: msg.user_id === 'groq-ai' ? 'assistant' : 'user',
      content: msg.data,
      timestamp: msg.timestamp
    }));

    // Build detailed tool information including MCP functions
    const toolsDescription = Object.values(availableTools).map(tool => {
      let toolInfo = `## ${tool.displayName} (${tool.id})
Type: ${tool.type}
Description: ${tool.description}
Trigger: ${tool.trigger_prompt || 'N/A'}
Examples: ${tool.examples.join('; ')}`;

      // Add MCP function details if available
      if (tool.mcp_functions && tool.mcp_functions.length > 0) {
        toolInfo += `\nAvailable Functions:`;
        tool.mcp_functions.forEach(func => {
          toolInfo += `\n  - ${func.name}: ${func.description}`;
          if (func.params && func.params.length > 0) {
            toolInfo += `\n    Parameters: ${func.params.join(', ')}`;
          }
        });
      }

      return toolInfo;
    }).join('\n\n');

    // Get today's date for context
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Dynamically generate system prompt from registry with detailed MCP function info
    const systemPrompt = `You are an intelligent routing system for Groq AI. Your task is to analyze user questions and select the most appropriate tools and specific functions to use.

TODAY'S DATE: ${today}

CRITICAL INSTRUCTIONS:
1. You MUST respond with VALID JSON only
2. Do NOT include any explanatory text before or after the JSON
3. The JSON must start with { and end with }
4. For MCP tools, specify which specific functions should be called
5. Extract parameters from the user's question when possible

QUESTION TO ANALYZE: "${question}"
USER: ${userName}

AVAILABLE TOOLS AND FUNCTIONS:
${toolsDescription}

ROUTING RULES:
1. **Salesforce Priority (COMPREHENSIVE)**: If user mentions ANYTHING related to sales, CRM, or business operations → ALWAYS use 'salesforce' tool
   - Sales terms: leads, contacts, accounts, opportunities, deals, prospects, customers, pipeline
   - Actions: create, search, find, get, show, update, convert, add note, create task
   - SOQL: any query with SELECT, FROM, WHERE, LIMIT keywords
   - The Salesforce MCP has 30+ functions and handles ALL CRM operations automatically
   
2. **Weather Priority**: If user asks about weather, temperature, forecast → use 'weather' tool

3. **Groq Compound Priority**: If user needs web search, current information, calculations, or code execution → use 'groq_compound' tool (FAST and lightweight)

4. **HuggingFace Priority**: If user asks about AI models, datasets, machine learning models → use 'huggingface' tool

5. **Parallel Search (Slow)**: Only use 'parallel_search' if groq_compound is insufficient or user specifically needs deep/multi-source search

6. **Direct Answer Fallback**: For general knowledge questions without need for external data → use 'direct_answer'

7. **Function Selection**: When selecting MCP tools, specify which functions to call based on the user's intent. For Salesforce, the MCP server has intelligent function routing so you can suggest common functions like sf_search_leads, sf_run_soql_query, etc.

8. **Parameter Extraction**: Extract relevant parameters from the user's question (e.g., company names, search terms, SOQL queries, record IDs)

**CRITICAL FOR SALESFORCE**: 
- The Salesforce MCP server handles ALL sales/CRM operations (30+ functions available)
- For SOQL queries: use 'sf_run_soql_query' with the full query as parameter
- For lead searches: use 'sf_search_leads' with company/name/status filters
- For creating records: use 'sf_create_lead', 'sf_create_account', etc.
- When in doubt about sales/CRM requests: ALWAYS choose 'salesforce' tool

REQUIRED JSON RESPONSE FORMAT:
{
  "tools": [
    {
      "tool_id": "tool_name",
      "functions": ["function_name"],
      "params": {
        "param_name": "extracted_value"
      }
    }
  ],
  "reasoning": "brief explanation of why these tools were selected",
  "primary_intent": "main user intent category",
  "confidence": 0.0
}

RESPONSE EXAMPLES:

Question: "search for leads in Acme Corp"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_leads"],
      "params": {
        "company": "Acme Corp"
      }
    }
  ],
  "reasoning": "User wants to search Salesforce leads for a specific company",
  "primary_intent": "crm_search",
  "confidence": 0.95
}

Question: "find a good image classification model on hugging face"
Response: {
  "tools": [
    {
      "tool_id": "huggingface",
      "functions": ["search_models"],
      "params": {
        "query": "image classification",
        "task": "image-classification"
      }
    }
  ],
  "reasoning": "User wants to find ML models for image classification",
  "primary_intent": "ai_ml",
  "confidence": 0.9
}

Question: "what's the weather in San Francisco"
Response: {
  "tools": [
    {
      "tool_id": "weather",
      "functions": [],
      "params": {
        "location": "San Francisco"
      }
    }
  ],
  "reasoning": "User wants weather information for a specific location",
  "primary_intent": "weather",
  "confidence": 0.95
}

Question: "create a new lead for John Doe at TechCorp"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_create_lead"],
      "params": {
        "first_name": "John",
        "last_name": "Doe",
        "company": "TechCorp"
      }
    }
  ],
  "reasoning": "User wants to create a new lead in Salesforce",
  "primary_intent": "crm_create",
  "confidence": 0.92
}

Question: "run SOQL query SELECT Id, Name FROM Lead LIMIT 10"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_run_soql_query"],
      "params": {
        "query": "SELECT Id, Name FROM Lead LIMIT 10"
      }
    }
  ],
  "reasoning": "User wants to execute a SOQL query in Salesforce",
  "primary_intent": "crm_query",
  "confidence": 0.98
}

Question: "get the latest leads"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_leads"],
      "params": {
        "limit": "10"
      }
    }
  ],
  "reasoning": "User wants to retrieve recent leads from Salesforce",
  "primary_intent": "crm_search",
  "confidence": 0.90
}

Now analyze the user's question and return ONLY valid JSON:`;

    const response = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: question
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const resultText = response.choices[0]?.message?.content || '';
    console.log(`🔍 ROUTING: AI raw response: "${resultText}"`);

    // Try to parse the JSON response - handle various formats
    try {
      // First try direct JSON parsing
      let routingDecision = JSON.parse(resultText);
      console.log(`✅ ROUTING: Successfully parsed JSON - tools: ${JSON.stringify(routingDecision.tools)}, reasoning: "${routingDecision.reasoning}", confidence: ${routingDecision.confidence}`);

      // Normalize tools array to support both old and new format
      const normalizedTools = routingDecision.tools.map(tool => {
        if (typeof tool === 'string') {
          // Old format: just tool IDs
          return { tool_id: tool, functions: [], params: {} };
        }
        // New format: tool objects with functions and params
        return tool;
      });

      return {
        tools: normalizedTools.map(t => t.tool_id), // Keep backward compatibility
        toolDetails: normalizedTools, // New detailed format
        reasoning: routingDecision.reasoning || 'AI-powered routing decision',
        primaryIntent: routingDecision.primary_intent || 'general',
        confidence: routingDecision.confidence || 0.8
      };
    } catch (parseError) {
      console.error('❌ ROUTING: Failed to parse routing decision as JSON:', parseError);

      // Try multiple methods to extract JSON from the response
      try {
        // Method 1: Look for JSON-like content with curly braces
        const jsonMatch = resultText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const extractedJson = JSON.parse(jsonMatch[0]);
          console.log(`🔄 ROUTING: Extracted JSON from braces`);
          const normalizedTools = (extractedJson.tools || []).map(tool => 
            typeof tool === 'string' ? { tool_id: tool, functions: [], params: {} } : tool
          );
          return {
            tools: normalizedTools.map(t => t.tool_id),
            toolDetails: normalizedTools,
            reasoning: extractedJson.reasoning || 'Extracted from AI response',
            primaryIntent: extractedJson.primary_intent || 'general',
            confidence: extractedJson.confidence || 0.6
          };
        }

        // Method 2: Try to find JSON between code blocks
        const codeBlockMatch = resultText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          const extractedJson = JSON.parse(codeBlockMatch[1]);
          console.log(`🔄 ROUTING: Extracted JSON from code block`);
          const normalizedTools = (extractedJson.tools || []).map(tool => 
            typeof tool === 'string' ? { tool_id: tool, functions: [], params: {} } : tool
          );
          return {
            tools: normalizedTools.map(t => t.tool_id),
            toolDetails: normalizedTools,
            reasoning: extractedJson.reasoning || 'Extracted from code block',
            primaryIntent: extractedJson.primary_intent || 'general',
            confidence: extractedJson.confidence || 0.6
          };
        }

      } catch (extractError) {
        console.error('❌ ROUTING: Failed to extract JSON from response:', extractError);
      }

      // If all parsing fails, return default
      console.log(`⚠️ ROUTING: All parsing failed, using default - tools: [direct_answer]`);
      return {
        tools: ['direct_answer'],
        toolDetails: [{ tool_id: 'direct_answer', functions: [], params: {} }],
        reasoning: 'Default routing due to parsing failure',
        primaryIntent: 'general',
        confidence: 0.5
      };
    }

  } catch (error) {
    console.error('❌ ROUTING: Intelligent routing error:', error);
    console.log(`⚠️ ROUTING: Error fallback - tools: [direct_answer]`);
    return {
      tools: ['direct_answer'],
      toolDetails: [{ tool_id: 'direct_answer', functions: [], params: {} }],
      reasoning: 'Error in intelligent routing, using direct answer',
      primaryIntent: 'general',
      confidence: 0.3
    };
  }
}

// Correct common misspellings of "Groq" to ensure system works
export function correctGroqSpelling(text) {
  if (!text) return text;

  // Common misspellings and variations to correct
  const corrections = [
    // Exact word replacements (case-sensitive for proper nouns)
    { from: /\bgrok\b/gi, to: 'Groq' },
    { from: /\bgrock\b/gi, to: 'Groq' },
    { from: /\bgroq\b/g, to: 'Groq' },
    { from: /\bGrok\b/g, to: 'Groq' },
    { from: /\bGrock\b/g, to: 'Groq' },

    // Contextual corrections for phrases
    { from: /hey\s+grok/gi, to: 'Hey Groq' },
    { from: /hey\s+grock/gi, to: 'Hey Groq' },
    { from: /hi\s+grok/gi, to: 'Hey Groq' },
    { from: /hello\s+grok/gi, to: 'Hey Groq' },

    // Handle cases where "groq" appears without "hey"
    { from: /^\s*grok\s+/gi, to: 'Groq ' },
    { from: /^\s*grock\s+/gi, to: 'Groq ' },
  ];

  let correctedText = text;

  // Apply all corrections
  corrections.forEach(correction => {
    correctedText = correctedText.replace(correction.from, correction.to);
  });

  // More specific Brock vs Grok handling
  if (correctedText.includes('Brock') && !correctedText.toLowerCase().includes('hugging')) {
    correctedText = correctedText.replace(/\bBrock\b/g, 'Groq');
  }

  // Add Hugging Face corrections
  correctedText = correctedText
    .replace(/\bhugging\s+clothes?\b/gi, 'Hugging Face')
    .replace(/\bhuging\s+face\b/gi, 'Hugging Face')
    .replace(/\bhuggingface\b/gi, 'Hugging Face')
    .replace(/\bhugging\s+face\b/gi, 'Hugging Face');

  return correctedText;
}

// Detect if text contains "Hey Groq" trigger using simple detection
export function detectGroqTrigger(text) {
  // Normalize common misspellings first
  const normalized = correctGroqSpelling(text || '');

  // Robust detection for "Hey Groq" with optional punctuation and spacing
  const canonical = normalized
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Common greeting words that can trigger Groq
  const GREETINGS = ['hey', 'hi', 'hello', 'yo', 'sup', 'what\'s up', 'greetings'];

  // Allow up to N words between greeting and "groq" (either order)
  const MAX_WORD_GAP = 6;

  // Build regex patterns for all greetings
  const greetingPatterns = GREETINGS.map(greeting => {
    // Escape special regex characters in greetings
    const escapedGreeting = greeting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Pattern for greeting then groq (with optional words in between)
    const greetingThenGroq = new RegExp(`\\b${escapedGreeting}\\b(?:\\s+\\S+){0,${MAX_WORD_GAP}}\\s+\\bgroq\\b`, 'i');
    // Pattern for groq then greeting (with optional words in between)
    const groqThenGreeting = new RegExp(`\\bgroq\\b(?:\\s+\\S+){0,${MAX_WORD_GAP}}\\s+\\b${escapedGreeting}\\b`, 'i');
    return { greetingThenGroq, groqThenGreeting };
  });

  // Test all greeting patterns
  const hasGreetingTrigger = greetingPatterns.some(patterns =>
    patterns.greetingThenGroq.test(canonical) || patterns.groqThenGreeting.test(canonical)
  );

  const hasTrigger = hasGreetingTrigger ||
                     /^groq\b/.test(canonical) ||
                     /\bheygroq\b/i.test(canonical);

  console.log(`🎤 Trigger detection for: "${text}" -> ${hasTrigger ? '✅ DETECTED' : '❌ NOT DETECTED'}`);

  return hasTrigger;
}


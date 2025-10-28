/**
 * AI Inference and Routing Functions
 * Handles intelligent routing, tool execution, and AI-powered inference
 */

import {
  groqClient,
  SALESFORCE_MCP_URL,
  MODEL_ROUTER,
  MODEL_INFERENCE,
  MODEL_DIRECT_ANSWER,
  MODEL_SYNTHESIS,
  ROUTER_RETRY_DELAY_MS
} from "../../config.js";
import { getAvailableTools } from "../../tool-registry-unified.js";
import { getSalesforceSessionId } from "../../auth-utils.js";
import { processToolAuth } from "../../auth-utils.js";
import { getSalesforceFocus, getFocusGoalPrompt } from "../../salesforce-focus.js";
import { getDirectives, getDirectivesPrompt } from "../../directives.js";
import { getScratchPad, getScratchPadPrompt } from "../../scratchpad.js";

// Enhanced AI-powered router that decides which tools and specific MCP functions to use
export async function intelligentRouter(question, userName, context = {}, chatHistory = []) {
  try {
    // Get routing information from unified registry
    const availableTools = getAvailableTools();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 ROUTING: Analyzing question: "${question}"`);
    console.log(`   User: ${userName}`);
    console.log(`   Chat history: ${chatHistory.length} messages (using last ${Math.min(30, chatHistory.length)} for context)`);
    console.log(`${'='.repeat(80)}`);

    // Prepare chat history context (last 30 messages for context)
    // Note: chatHistory comes from frontend with newest first, so take first 30 and reverse
    const recentHistory = chatHistory
      .slice(0, 30)
      .reverse() // Reverse to get chronological order (oldest to newest)
      .map(msg => ({
        role: msg.user_id === 'zoom-ai' || msg.user_id === 'discovery-ai' ? 'assistant' : 'user',
        content: msg.data,
        timestamp: msg.timestamp,
        tools: msg.tools || []
      }));
    
    // Detect if recent conversation has Salesforce context
    const hasSalesforceContext = recentHistory.some(msg => 
      msg.tools && msg.tools.some(tool => 
        tool.category === 'mcp' && tool.server === 'Salesforce'
      )
    );
    
    console.log(`🔍 ROUTING: Salesforce context in recent history: ${hasSalesforceContext ? 'YES' : 'NO'}`);

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

    // Build context string from chat history
    const contextHint = hasSalesforceContext
      ? '\n\n⚠️ **CONTEXT ALERT**: Recent conversation includes Salesforce operations (leads/contacts/accounts). If the current question refers to "update", "change", "fix", or mentions a person\'s name without explicit context, it is LIKELY a Salesforce update request. Strongly consider using the \'salesforce\' tool.'
      : '';

    // Get active directives and scratch pad
    const directives = getDirectives('default');
    const directivesPrompt = directives ? getDirectivesPrompt(directives) : '';
    const scratchPad = getScratchPad('default');
    const scratchPadPrompt = scratchPad ? getScratchPadPrompt(scratchPad) : '';

    // Dynamically generate system prompt from registry with detailed MCP function info
    const systemPrompt = `You are an intelligent routing system for Zoom AI. Your task is to analyze user questions and select the most appropriate tools and specific functions to use.${directivesPrompt}${scratchPadPrompt}

TODAY'S DATE: ${today}

CRITICAL INSTRUCTIONS:
1. You MUST respond with VALID JSON only
2. Do NOT include any explanatory text before or after the JSON
3. The JSON must start with { and end with }
4. For MCP tools, specify which specific functions should be called
5. Extract parameters from the user's question when possible
6. **CONTEXT-AWARE ROUTING**: 
   - Route ONLY the CURRENT question, but USE the conversation context to understand it fully
   - If the current question is a FOLLOW-UP (asks about "this", "that", "their goal", "what about X"), consider it part of the ongoing conversation
   - If the current question refers to topics from previous messages, the tool you select MUST have access to that context
   - For implicit references (e.g., "update it" refers to the last mentioned Salesforce record), use chat history to understand what "it" means${contextHint}

CURRENT QUESTION TO ANALYZE: "${question}"
USER: ${userName}

RECENT CONVERSATION CONTEXT (for understanding references and follow-up questions):
${recentHistory.slice(-8).map(msg => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content?.substring(0, 200)}...`).join('\n')}

AVAILABLE TOOLS AND FUNCTIONS:
${toolsDescription}

ROUTING RULES:
1. **MULTIPLE REQUESTS HANDLING**: Users may include multiple commands in a single message (e.g., "search for leads in Acme AND get the weather in SF"). You MUST identify ALL separate requests and return multiple tool entries in the tools array. Each distinct request should have its own tool entry.

2. **Salesforce Priority (COMPREHENSIVE)**: If user mentions ANYTHING related to sales, CRM, or business operations → ALWAYS use 'salesforce' tool
   - Sales terms: leads, contacts, accounts, opportunities, deals, prospects, customers, pipeline
   - Actions: create, search, find, get, show, **UPDATE**, **CHANGE**, **MODIFY**, **EDIT**, **FIX**, **CORRECT**, **RENAME**, convert, add note, create task
   - ⚠️ **UPDATE OPERATIONS**: If user says "change", "update", "modify", "edit", "set", "fix", "correct", "rename", "spelled wrong" on ANY field (name, company, email, phone, etc.) on a lead/contact/account → ALWAYS use 'salesforce' tool
   - ⚠️ **NAME UPDATES**: If user says "update the name", "change the name", "spelled it wrong", "fix the name", "correct the spelling" → ALWAYS use 'salesforce' tool to update the record
   - SOQL: any query with SELECT, FROM, WHERE, LIMIT keywords
   - The Salesforce MCP has 30+ functions and handles ALL CRM operations automatically
   
3. **Weather Priority**: If user asks about weather, temperature, forecast → use 'weather' tool

4. **Groq Compound Priority (PREFER THIS)**: If user needs web search, current information, calculations, or code execution → use 'groq_compound' tool (FAST and lightweight)
   - **CRITICAL**: For ANY question about specific events, conferences, products, companies, people, or current topics → use 'groq_compound'
   - Questions like "what is [specific name]", "when is [event]", "who is [person]" usually need web search
   - If you're unsure whether the user is asking about something specific or general knowledge → DEFAULT TO 'groq_compound' (it's fast and can handle general questions too)
   - Examples: "what is the ship ai conf?", "when is the next conference?", "what is Anthropic's goal?", "who won the game?"

5. **HuggingFace Priority**: If user asks about AI models, datasets, machine learning models → use 'huggingface' tool

6. **Parallel Search (Slow)**: Only use 'parallel_search' if groq_compound is insufficient or user specifically needs deep/multi-source search

7. **Direct Answer (LAST RESORT)**: ONLY for very general knowledge questions that are CLEARLY established facts with no time-sensitivity
   - Use ONLY when you're 100% certain the answer is static, well-known general knowledge
   - Examples: "what is 2+2?", "what color is the sky?", "what is photosynthesis?"
   - DO NOT use for: specific events, conferences, products, companies, people, current topics, or anything time-sensitive
   - **When in doubt between direct_answer and groq_compound → choose 'groq_compound'**

8. **Function Selection**: When selecting MCP tools, specify which functions to call based on the user's intent. For Salesforce, the MCP server has intelligent function routing so you can suggest common functions like sf_search_leads, sf_run_soql_query, etc.

9. **Parameter Extraction**: Extract relevant parameters from the user's question (e.g., company names, search terms, SOQL queries, record IDs)

**CRITICAL FOR SALESFORCE**: 
- The Salesforce MCP server handles ALL sales/CRM operations (30+ functions available)
- For SOQL queries: use 'sf_run_soql_query' with the full query as parameter
- For lead searches: use 'sf_search_leads' with company/name/status filters
- For creating records: use 'sf_create_lead', 'sf_create_account', etc.
- **For UPDATING records**: Use 'sf_update_lead', 'sf_update_contact', 'sf_update_account' with record ID and fields to update
- **UPDATE WORKFLOW**: When user says "change/update/fix/correct [person's] [field] to [value]":
  1. First: Search for the record by name (e.g., 'sf_search_leads' with name filter)
  2. Then: Update the found record using 'sf_update_lead' with the record ID and new field values
- **NAME UPDATE WORKFLOW**: When user says "I spelled it wrong", "update the name", "fix the name", "change name to [new name]":
  1. First: Search for the most recent lead/contact using context from chat history
  2. Then: Update the name fields (first_name, last_name) using 'sf_update_lead' or 'sf_update_contact'
- **For adding notes**: Use 'sf_create_note' with parent_id (the record ID to attach the note to), title, and body
- **IMPORTANT NOTE WORKFLOW**: When user says "add a note to [person]" you should suggest BOTH functions in sequence:
  1. First: 'sf_search_contacts' to find the contact by name
  2. Then the MCP server will automatically use the found contact ID to call 'sf_create_note'
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

Question: "what is the ship ai conf?"
Response: {
  "tools": [
    {
      "tool_id": "groq_compound",
      "functions": [],
      "params": {
        "query": "ship ai conference"
      }
    }
  ],
  "reasoning": "User asking about a specific conference/event - needs web search for current information. This is NOT general knowledge.",
  "primary_intent": "web_search",
  "confidence": 0.95
}

Question: "what is photosynthesis?"
Response: {
  "tools": [
    {
      "tool_id": "direct_answer",
      "functions": [],
      "params": {}
    }
  ],
  "reasoning": "General knowledge question about well-established scientific concept - no web search needed",
  "primary_intent": "general_knowledge",
  "confidence": 0.98
}

Question: "what's the weather in NYC and also search for leads in Acme Corp"
Response: {
  "tools": [
    {
      "tool_id": "weather",
      "functions": [],
      "params": {
        "location": "NYC"
      }
    },
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_leads"],
      "params": {
        "company": "Acme Corp"
      }
    }
  ],
  "reasoning": "User has TWO separate requests: weather check AND Salesforce lead search. Both tools needed.",
  "primary_intent": "multiple_requests",
  "confidence": 0.95
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

Question: "add a note to Bob Jones reminding me to email him the examples"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_contacts", "sf_create_note"],
      "params": {
        "last_name": "Jones",
        "first_name": "Bob",
        "title": "Email Reminder",
        "body": "Need to email Bob the examples."
      }
    }
  ],
  "reasoning": "User wants to add a note to a contact in Salesforce. First search for Bob Jones, then add the note to his record.",
  "primary_intent": "crm_note",
  "confidence": 0.93
}

Question: "change Elizabeth Holmes company to Theranos"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_leads", "sf_update_lead"],
      "params": {
        "first_name": "Elizabeth",
        "last_name": "Holmes",
        "company": "Theranos"
      }
    }
  ],
  "reasoning": "User wants to update a lead's company field in Salesforce. First search for Elizabeth Holmes, then update the company field to Theranos.",
  "primary_intent": "crm_update",
  "confidence": 0.95
}

Question: "I spelled it wrong. Can you update the name to Satya Nadella?"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_leads", "sf_update_lead"],
      "params": {
        "first_name": "Satya",
        "last_name": "Nadella",
        "update_name": true
      }
    }
  ],
  "reasoning": "User wants to correct/update a lead's name in Salesforce. This is a field update operation that requires the Salesforce tool to search for the lead and update the name fields.",
  "primary_intent": "crm_update",
  "confidence": 0.95
}

Example with CONTEXT:
Recent Context: "Assistant: I've added Sacha Nadella as a lead..."
Question: "Um, can you update the Sacha Nadella?"
Response: {
  "tools": [
    {
      "tool_id": "salesforce",
      "functions": ["sf_search_leads", "sf_update_lead"],
      "params": {
        "last_name": "Nadella",
        "first_name": "Sacha"
      }
    }
  ],
  "reasoning": "Context shows recent Salesforce lead creation. Vague 'update' reference with person's name indicates Salesforce update operation.",
  "primary_intent": "crm_update",
  "confidence": 0.90
}

Now analyze the user's question and return ONLY valid JSON:`;

    // Race-based retry system: Fire initial request, then fire a retry after configured delay
    // Whichever completes first wins
    const RETRY_DELAY_MS = ROUTER_RETRY_DELAY_MS;
    
    console.log(`🏁 ROUTING: Starting race-based router request (retry after ${RETRY_DELAY_MS}ms)...`);
    
    const createRouterRequest = () => {
      return groqClient.chat.completions.create({
        model: MODEL_ROUTER,
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
        temperature: 0.1, // Low temperature for consistent JSON output
        max_tokens: 4096, // Increased for detailed function/param extraction
        response_format: { type: "json_object" } // Force JSON response
      });
    };
    
    // Fire the first request immediately
    const firstRequest = createRouterRequest();
    let firstRequestFinished = false;
    
    // Set up the retry request to fire after delay
    const retryPromise = new Promise((resolve, reject) => {
      const retryTimer = setTimeout(async () => {
        if (!firstRequestFinished) {
          console.log(`🔄 ROUTING: First request taking too long, firing retry request...`);
          try {
            const retryResponse = await createRouterRequest();
            console.log(`✅ ROUTING: Retry request completed first!`);
            resolve(retryResponse);
          } catch (error) {
            console.error(`❌ ROUTING: Retry request failed:`, error);
            reject(error);
          }
        } else {
          // First request already finished, no need for retry
          resolve(null);
        }
      }, RETRY_DELAY_MS);
    });
    
    // Race between the first request and the retry
    let response;
    try {
      response = await Promise.race([
        firstRequest.then(r => {
          firstRequestFinished = true;
          console.log(`✅ ROUTING: First request completed!`);
          return r;
        }),
        retryPromise
      ]);
      
      // If retry returned null (first finished), wait for first
      if (!response) {
        response = await firstRequest;
      }
    } catch (error) {
      // If race fails, try to wait for the first request as fallback
      console.error(`⚠️ ROUTING: Race failed, falling back to first request:`, error);
      try {
        response = await firstRequest;
        console.log(`✅ ROUTING: Fallback to first request succeeded`);
      } catch (fallbackError) {
        console.error(`❌ ROUTING: Both requests failed:`, fallbackError);
        throw fallbackError;
      }
    }

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

// Correct common misspellings of "Zoom" to ensure system works
export function correctZoomSpelling(text) {
  if (!text) return text;

  // Common misspellings and variations to correct
  const corrections = [
    // Exact word replacements (case-sensitive for proper nouns)
    { from: /\bzoom\b/g, to: 'Zoom' },         // zoom -> Zoom (standardize)
    { from: /\bZOOM\b/g, to: 'Zoom' },         // ZOOM -> Zoom
    { from: /\bzooom\b/gi, to: 'Zoom' },       // zooom -> Zoom
    { from: /\bzom\b/gi, to: 'Zoom' },         // zom -> Zoom

    // Contextual corrections for phrases
    { from: /hey\s+zoom/gi, to: 'Hey Zoom' },    // "hey zoom" -> "Hey Zoom"
    { from: /hi\s+zoom/gi, to: 'Hey Zoom' },     // "hi zoom" -> "Hey Zoom"
    { from: /hello\s+zoom/gi, to: 'Hey Zoom' },  // "hello zoom" -> "Hey Zoom"

    // Handle cases where "zoom" appears without "hey"
    { from: /^\s*zoom\s+/gi, to: 'Zoom ' },      // "zoom something" -> "Zoom something"
  ];

  let correctedText = text;

  // Apply all corrections
  corrections.forEach(correction => {
    correctedText = correctedText.replace(correction.from, correction.to);
  });

  // Add Hugging Face corrections
  correctedText = correctedText
    .replace(/\bhugging\s+clothes?\b/gi, 'Hugging Face')
    .replace(/\bhuging\s+face\b/gi, 'Hugging Face')
    .replace(/\bhuggingface\b/gi, 'Hugging Face')
    .replace(/\bhugging\s+face\b/gi, 'Hugging Face');


  return correctedText;
}

// Detect if text contains "Hey Zoom" trigger using simple detection
export function detectZoomTrigger(text) {
  // Normalize common misspellings first
  const normalized = correctZoomSpelling(text || '');

  // Robust detection for "Hey Zoom" with optional punctuation and spacing
  const canonical = normalized
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ') // ignore punctuation between/around words
    .replace(/\s+/g, ' ')
    .trim();

  // Common greeting words that can trigger Zoom
  const GREETINGS = ['hey', 'hi', 'hello', 'yo', 'sup', 'what\'s up', 'greetings'];

  // Allow up to N words between greeting and "zoom" (either order)
  const MAX_WORD_GAP = 6;

  // Build regex patterns for all greetings
  const greetingPatterns = GREETINGS.map(greeting => {
    // Escape special regex characters in greetings
    const escapedGreeting = greeting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Pattern for greeting then zoom (with optional words in between)
    const greetingThenZoom = new RegExp(`\\b${escapedGreeting}\\b(?:\\s+\\S+){0,${MAX_WORD_GAP}}\\s+\\bzoom\\b`, 'i');
    // Pattern for zoom then greeting (with optional words in between)
    const zoomThenGreeting = new RegExp(`\\bzoom\\b(?:\\s+\\S+){0,${MAX_WORD_GAP}}\\s+\\b${escapedGreeting}\\b`, 'i');
    return { greetingThenZoom, zoomThenGreeting };
  });

  // Test all greeting patterns
  const hasGreetingTrigger = greetingPatterns.some(patterns =>
    patterns.greetingThenZoom.test(canonical) || patterns.zoomThenGreeting.test(canonical)
  );

  const hasTrigger = hasGreetingTrigger ||
                     /^zoom\b/.test(canonical) ||
                     /\bheyzoom\b/i.test(canonical);

  console.log(`🎤 Trigger detection for: "${text}" -> ${hasTrigger ? '✅ DETECTED' : '❌ NOT DETECTED'}`);

  return hasTrigger;
}

// Get weather using Groq compound model
export async function getWeather(location) {
  try {
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const response = await groqClient.chat.completions.create({
      model: "groq/compound-mini",
      messages: [
        {
          role: "system",
          content: `You are Zoom AI, a helpful weather assistant. TODAY'S DATE: ${today}. Respond with a single short line.`
        },
        {
          role: "user",
          content: `What's the current weather in ${location}? Return ONLY a single sentence with temperature, conditions, and any relevant details. Keep it brief and conversational.`,
        },
      ],
    });

    return {
      response: response.choices[0]?.message?.content || "I couldn't get the weather information right now.",
      tool: "weather"
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return {
      response: `Sorry, I couldn't get the weather for ${location} at the moment.`,
      tool: "weather",
      error: true
    };
  }
}

// Perform web search and/or code execution using Groq compound model
export async function performWebSearch(query, context = {}) {
  try {
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const messages = [
      {
        role: "system",
        content: `You are Zoom AI, a helpful assistant with web search and code execution capabilities. TODAY'S DATE: ${today}

**CRITICAL CONTEXT INSTRUCTIONS**:
- The user may ask FOLLOW-UP questions that refer to previous messages in the conversation
- ALWAYS read the <conversation_context> section below to understand what the user is referring to
- If the user says "what about X" or "what's their goal" or "tell me more", look at recent messages to understand the full context
- Combine information from the conversation history with your web search results to provide complete answers`
      }
    ];

    // Add chat history for conversational context if available
    // Use contextStrategy to determine how much context to include
    const contextStrategy = context.contextStrategy || 'full'; // Default to full context
    const chatHistory = context.chatHistory || [];
    
    if (chatHistory && chatHistory.length > 0) {
      // Adjust context amount based on strategy:
      // - 'minimal': Last 3-5 messages only (for command-style queries)
      // - 'full': Last 20 messages (for conversational/research queries)
      const contextLimit = contextStrategy === 'minimal' ? 5 : 20;
      
      const recentHistory = chatHistory
        .slice(0, contextLimit)
        .filter(msg => 
          msg.user_id !== 'system' && 
          msg.user_id !== 'discovery-ai' && 
          msg.data &&
          msg.data !== query &&
          msg.original_data !== query
        )
        .reverse(); // Chronological order
      
      console.log(`🔍 performWebSearch: Using ${contextStrategy} context strategy (${recentHistory.length}/${contextLimit} messages)`);
      
      if (recentHistory.length > 0) {
        const historyText = recentHistory.map((msg) => {
          const role = msg.user_id === 'zoom-ai' ? 'Assistant' : msg.user_name || 'User';
          return `${role}: ${msg.data}`;
        }).join('\n');
        
        messages.push({
          role: "user",
          content: `<conversation_context>
Previous conversation for reference:

${historyText}
</conversation_context>`
        });
      }
    }

    // Add the current query
    messages.push({
      role: "user",
      content: query, // Compound model will figure out if it needs web search, code execution, or both
    });

    console.log(`🔧 Calling Groq Compound API with ${messages.length} messages`);
    
    // The Groq Compound model handles web search and code execution internally
    // We need to let it manage its own tools without specifying tool_choice
    const response = await groqClient.chat.completions.create({
      model: "groq/compound",
      messages: messages,
      temperature: 0.7, // Add temperature for stability
      max_tokens: 16000, // Generous limit to prevent truncation
    });

    return {
      response: response.choices[0]?.message?.content || "I couldn't process your request right now.",
      tool: "groq_compound"
    };
  } catch (error) {
    console.error('Groq compound error:', error);
    
    // Check if this is the "Tool choice is none, but model called a tool" error
    // This can happen intermittently with the compound model
    if (error.message?.includes('Tool choice is none') || error.message?.includes('model called a tool')) {
      console.warn('⚠️ Groq Compound tool choice error detected - attempting retry with simplified prompt...');
      
      try {
        // Retry with a more direct, simplified prompt
        const retryMessages = [{
          role: "user",
          content: `Please answer this question: ${query}`
        }];
        
        console.log('🔄 Retry attempt with simplified prompt');
        const retryResponse = await groqClient.chat.completions.create({
          model: "groq/compound",
          messages: retryMessages,
        });
        
        console.log('✅ Retry successful!');
        return {
          response: retryResponse.choices[0]?.message?.content || "I couldn't process your request right now.",
          tool: "groq_compound",
          retried: true
        };
      } catch (retryError) {
        console.error('❌ Retry failed:', retryError);
        // Fall through to generic error handling
      }
    }
    
    return {
      response: `Sorry, I couldn't process "${query}" at the moment. ${error.message || ''}`,
      tool: "groq_compound",
      error: true
    };
  }
}

// Answer question directly using OpenAI GPT model
export async function answerDirectly(question, context = {}) {
  try {
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = `You are a helpful AI assistant. TODAY'S DATE: ${today}

Context: Conversation with ${context.userName || 'Unknown'}

Instructions:
- Maintain continuity with the conversation thread
- Reference previous messages when relevant
- Be concise but helpful`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add chat history if available
    // Direct answer is almost always conversational, so default to full context
    const contextStrategy = context.contextStrategy || 'full';
    const chatHistory = context.chatHistory || [];
    
    if (chatHistory && chatHistory.length > 0) {
      // Direct answer typically needs full context since it's used for conversational queries
      // But respect minimal strategy if explicitly set (rare case)
      const contextLimit = contextStrategy === 'minimal' ? 5 : 30;
      
      const recentHistory = chatHistory
        .slice(0, contextLimit)
        .filter(msg => 
          msg.user_id !== 'system' && 
          msg.user_id !== 'discovery-ai' && 
          msg.data &&
          msg.data !== question &&
          msg.original_data !== question
        )
        .reverse();
      
      console.log(`💬 answerDirectly: Using ${contextStrategy} context strategy (${recentHistory.length}/${contextLimit} messages)`);
      
      // Add chat history as proper chat messages (not as a summary)
      // This prevents the AI from thinking it's reading a third-person summary
      if (recentHistory.length > 0) {
        console.log(`💬 answerDirectly: Adding ${recentHistory.length} history messages in proper chat format`);
        recentHistory.forEach((msg, idx) => {
          const role = msg.user_id === 'zoom-ai' || msg.user_id === 'discovery-ai' ? 'assistant' : 'user';
          console.log(`   [${idx}] ${role}: ${msg.data?.substring(0, 60)}...`);
          messages.push({
            role: role,
            content: msg.data
          });
        });
      }
    }

    // Add the current question
    console.log(`💬 answerDirectly: Adding current question: "${question}"`);
    messages.push({
      role: "user",
      content: question
    });

    console.log(`💬 answerDirectly: Sending ${messages.length} total messages to LLM (1 system + ${messages.length - 1} conversation)`);
    console.log(`💬 answerDirectly: Using model: ${MODEL_DIRECT_ANSWER}`);
    console.log(`💬 answerDirectly: FULL MESSAGES BEING SENT TO LLM:`);
    messages.forEach((msg, idx) => {
      console.log(`   [${idx}] ${msg.role}: ${msg.content}`);
    });
    
    const response = await groqClient.chat.completions.create({
      model: MODEL_DIRECT_ANSWER,
      messages: messages,
      max_tokens: 16000 // Generous limit to prevent truncation
    });
    
    console.log(`💬 answerDirectly: Received response: ${response.choices[0]?.message?.content?.substring(0, 100)}...`);
    console.log(`💬 answerDirectly: FULL RESPONSE FROM LLM: ${response.choices[0]?.message?.content}`);

    return {
      response: response.choices[0]?.message?.content || "I couldn't generate a response right now.",
      tool: "direct_answer"
    };
  } catch (error) {
    console.error('Direct answer error:', error);
    return {
      response: `Sorry, I couldn't answer that question directly at the moment.`,
      tool: "direct_answer",
      error: true
    };
  }
}

// Generic inference function using intelligent routing with MCP support
// requestHeaders (optional): HTTP headers from incoming request (for bearer token passthrough)
export async function performGroqInference(transcript, userName, context = 'general', chatHistory = [], skipTriggerDetection = false, progressCallback = null, requestHeaders = null, skipDiscovery = false) {
  console.log(`\n🚀 performGroqInference CALLED`);
  console.log(`   Transcript: "${transcript}"`);
  console.log(`   User: ${userName}`);
  console.log(`   Context: ${context}`);
  console.log(`   Chat History Length: ${chatHistory.length}`);
  console.log(`   Skip Trigger Detection: ${skipTriggerDetection}`);
  console.log(`   Progress Callback: ${progressCallback ? 'YES' : 'NO'}`);
  console.log(`   Skip Discovery: ${skipDiscovery}`);

  try {
    // First, detect if this is actually a Zoom trigger (unless skipped)
    if (!skipTriggerDetection) {
      console.log(`   🔍 Checking for Zoom trigger...`);
      const isZoomTrigger = detectZoomTrigger(transcript);

      if (!isZoomTrigger) {
        console.log(`   ❌ No Zoom trigger detected`);
        return {
          detected: false,
          response: `I didn't detect a "Hey Zoom" trigger in: "${transcript}"`
        };
      }
      console.log(`   ✅ Zoom trigger detected!`);
    } else {
      console.log(`   ⏭️ Skipping trigger detection (already validated by frontend)`);
    }

    // Use intelligent router to decide which tools to use (now with chat history)
    // Router works with original transcript text (no spelling corrections)
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 ROUTING START: Analyzing query`);
    console.log(`   User: ${userName}`);
    console.log(`   Query: "${transcript}"`);
    console.log(`   Context: ${context}`);
    console.log(`   Chat History: ${chatHistory.length} messages`);
    console.log(`${'='.repeat(80)}\n`);
    
    console.log(`⏳ Calling intelligentRouter...`);
    let routingDecision;
    try {
      routingDecision = await intelligentRouter(transcript, userName, context, chatHistory);
      console.log(`✅ intelligentRouter returned successfully`);
    } catch (routerError) {
      console.error(`❌ intelligentRouter FAILED:`, routerError);
      console.error(`   Error message: ${routerError.message}`);
      console.error(`   Error stack:`, routerError.stack);
      throw routerError; // Re-throw to be caught by outer try-catch
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 ROUTING RESULT`);
    console.log(`   Tools Selected: [${routingDecision.tools.join(', ')}]`);
    console.log(`   Tool Count: ${routingDecision.tools.length}${routingDecision.tools.length > 1 ? ' ⚠️ MULTIPLE REQUESTS DETECTED' : ''}`);
    console.log(`   Reasoning: "${routingDecision.reasoning}"`);
    console.log(`   Primary Intent: ${routingDecision.primaryIntent}`);
    console.log(`   Confidence: ${routingDecision.confidence}`);
    
    // CRITICAL: Determine context strategy based on tool types
    // MCP/Command tools need MINIMAL context to avoid confusion
    // Conversational/Research tools need FULL context to maintain thread
    const hasMcpTools = routingDecision.tools.some(tool => 
      ['salesforce', 'huggingface', 'parallel_search'].includes(tool)
    );
    const hasConversationalTools = routingDecision.tools.some(tool => 
      ['direct_answer', 'groq_compound', 'weather'].includes(tool)
    );
    
    // Analyze if the question is a follow-up/reference to previous messages
    const isFollowUpQuestion = /^(what about|tell me more|what's their|what is their|and what|how about|what if|why|how|explain|elaborate)/i.test(transcript.trim()) ||
                               /(this|that|these|those|it|they|them|their)\b/i.test(transcript);
    
    const contextStrategy = hasMcpTools && !isFollowUpQuestion ? 'minimal' : 'full';
    console.log(`   Context Strategy: ${contextStrategy.toUpperCase()} (${
      contextStrategy === 'minimal' 
        ? 'MCP tool - using minimal context to avoid confusion' 
        : 'Conversational/follow-up - using full context to maintain thread'
    })`);
    
    // Store context strategy in routing decision for later use
    routingDecision.contextStrategy = contextStrategy;
    routingDecision.isFollowUpQuestion = isFollowUpQuestion;
    
    // Broadcast routing decision to frontend
    if (progressCallback) {
      const toolsList = routingDecision.tools.map(t => t.replace('_', ' ')).join(', ');
      progressCallback(`Analyzing... Will use: ${toolsList}`);
    }
    
    // Log detailed tool information including functions and params
    if (routingDecision.toolDetails && routingDecision.toolDetails.length > 0) {
      console.log(`\n📋 DETAILED TOOL ROUTING:`);
      routingDecision.toolDetails.forEach((toolDetail, idx) => {
        console.log(`\n   ${idx + 1}. Tool: ${toolDetail.tool_id}`);
        if (toolDetail.functions && toolDetail.functions.length > 0) {
          console.log(`      Functions: [${toolDetail.functions.join(', ')}]`);
        }
        if (toolDetail.params && Object.keys(toolDetail.params).length > 0) {
          console.log(`      Params: ${JSON.stringify(toolDetail.params, null, 8)}`);
        }
      });
    }
    console.log(`${'='.repeat(80)}\n`);

    const availableTools = getAvailableTools();
    const toolResults = [];
    let finalResponse = '';
    const toolsUsed = [];
    const mcpTools = [];

    // Prepare MCP tools for the Responses API: include ONLY MCP tools selected by the router
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 MCP TOOL PREPARATION`);
    console.log(`   Processing ${routingDecision.tools.length} tools from router...`);
    
    for (const toolName of routingDecision.tools) {
      console.log(`\n   📦 Processing tool: ${toolName}`);
      const toolConfig = availableTools[toolName];
      
      if (!toolConfig) {
        console.warn(`   ⚠️ Tool config not found: ${toolName}`);
        continue;
      }
      
      if (toolConfig.type !== 'mcp') {
        console.log(`   ℹ️ Skipping non-MCP tool: ${toolName} (type: ${toolConfig.type})`);
        continue;
      }

      // Dynamically set server URL for Salesforce
      const serverUrl = toolConfig.id === 'salesforce' 
        ? `${SALESFORCE_MCP_URL}/mcp`
        : toolConfig.server_url;
      
      console.log(`   🌐 Server URL: ${serverUrl || 'NOT SET'}`);

      const mcpToolConfig = {
        type: 'mcp',
        server_label: toolConfig.server_label,
        server_url: serverUrl,
      };

      // Use generalized auth processing
      console.log(`   🔐 Processing authentication for ${toolName}...`);
      
      // CRITICAL FIX: For Salesforce, do NOT include auth headers by default
      // The AI will call sf_set_credentials first to establish the session
      // However, if bearer token is provided in request headers, we DO pass it through
      if (toolName === 'salesforce') {
        // Check if bearer token is in request headers
        const authResult = processToolAuth(toolConfig, 'default', requestHeaders);
        
        if (authResult.headers && Object.keys(authResult.headers).length > 0) {
          // Bearer token found in request headers - pass it through
          mcpToolConfig.headers = authResult.headers;
          console.log(`   🔐 Salesforce: Using bearer token from request headers`);
        } else {
          // No bearer token - use sf_set_credentials flow
          console.log(`   ⚠️ Salesforce: No bearer token in request, will use sf_set_credentials instead`);
          mcpToolConfig.headers = {};
        }
      } else {
        // For other MCP tools, use standard auth processing
        const authResult = processToolAuth(toolConfig, 'default', requestHeaders);
        
        if (!authResult.shouldInclude) {
          console.warn(`   ❌ Skipping MCP tool ${toolName}: ${authResult.error}`);
          continue;
        }

        // Add authentication headers from processToolAuth
        // These are required for MCP servers that need authentication (like Parallel API)
        mcpToolConfig.headers = authResult.headers || {};
        
        console.log(`   🔑 Auth headers configured: ${Object.keys(mcpToolConfig.headers).length > 0 ? Object.keys(mcpToolConfig.headers).join(', ') : 'none'}`);
      }

      console.log(`   ✅ Added MCP tool to request: ${toolName}`);
      mcpTools.push(mcpToolConfig);
    }
    
    console.log(`\n   Final MCP tools count: ${mcpTools.length}`);
    console.log(`${'='.repeat(80)}\n`);

    // If we have MCP tools, use the chat completions API with MCP tools
    if (mcpTools.length > 0) {
      try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🚀 GROQ API CALL WITH MCP TOOLS`);
        console.log(`   MCP tools count: ${mcpTools.length}`);

        // Get today's date for context
        const today = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        // Get Salesforce credentials if needed - add to system prompt
        const sfCreds = getSalesforceSessionId('default');

        // Get Salesforce focus goal if set
        const sfFocus = getSalesforceFocus('default');
        const focusPrompt = sfFocus ? getFocusGoalPrompt(sfFocus) : '';

        // Get active directives and scratch pad
        const directivesInference = getDirectives('default');
        const directivesPromptInference = directivesInference ? getDirectivesPrompt(directivesInference) : '';
        const scratchPadInference = getScratchPad('default');
        const scratchPadPromptInference = scratchPadInference ? getScratchPadPrompt(scratchPadInference) : '';

        const messages = [];

        // Add system message - SIMPLIFIED to reduce token bloat
        messages.push({
          role: "system",
          content: `You are Zoom AI assistant. Today's date is ${today}. Provide accurate, helpful responses using available tools.

For Salesforce: Credentials are in the user message. Call functions directly (sf_search_leads, sf_create_lead, sf_run_soql_query, etc.).${focusPrompt}${directivesPromptInference}${scratchPadPromptInference}`
        });
        
        if (sfFocus) {
          console.log(`🎯 Salesforce Focus Active:`, {
            description: sfFocus.description,
            recordId: sfFocus.recordId || 'N/A',
            name: sfFocus.name || 'N/A'
          });
        }
        
        // Build the user message based on router's extracted intent
        // SIMPLIFIED APPROACH: Use router's extracted params to create a clean, directed request
        let userMessageContent = '';
        let directedRequest = transcript; // Default to original transcript
        
        // Add Salesforce credentials at the start if using Salesforce tools (per MCP protocol)
        if (sfCreds && routingDecision.tools.includes('salesforce')) {
          const credentialsObj = {
            access_token: sfCreds.access_token,
            instance_url: sfCreds.instance_url,
            state: sfCreds.state || `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          
          userMessageContent = `${JSON.stringify(credentialsObj, null, 2)}\n\n`;
          console.log(`   🔐 Adding Salesforce credentials to user message`);
          
          // Extract the Salesforce tool details from routing decision
          const sfToolDetail = routingDecision.toolDetails?.find(t => t.tool_id === 'salesforce');
          
          if (sfToolDetail && sfToolDetail.params && Object.keys(sfToolDetail.params).length > 0) {
            // Router extracted specific params - create a directed request
            console.log(`   🎯 Router extracted params:`, sfToolDetail.params);
            
            // Build a clean, directed request based on extracted params
            if (sfToolDetail.functions && sfToolDetail.functions.length > 0) {
              directedRequest = `${transcript}`;
              console.log(`   ✅ Using directed request with router-extracted context`);
            }
          }
        }
        
        // MINIMAL user message: credentials + simple request (matching successful curl pattern)
        userMessageContent += directedRequest;
        
        // Push the complete user message
        messages.push({
          role: "user",
          content: userMessageContent
        });
        
        console.log(`   ✅ User message created (credentials: ${sfCreds && routingDecision.tools.includes('salesforce') ? 'YES' : 'NO'})`);
        console.log(`   📝 User message length: ${userMessageContent.length} chars`);

        console.log(`\n   📤 REQUEST DETAILS:`);
        console.log(`      Model: openai/gpt-oss-120b`);
        console.log(`      Messages count: ${messages.length}`);
        console.log(`      MCP Tools: ${mcpTools.map(t => t.server_label).join(', ')}`);
        console.log(`\n   📝 Messages:`);
        messages.forEach((msg, idx) => {
          if (msg.role === 'system') {
            console.log(`      ${idx + 1}. [SYSTEM] ${msg.content.substring(0, 60)}...`);
          } else if (msg.role === 'assistant' && msg.tool_calls) {
            console.log(`      ${idx + 1}. [ASSISTANT] Tool calls: ${msg.tool_calls.length} call(s)`);
          } else if (msg.role === 'tool') {
            console.log(`      ${idx + 1}. [TOOL] ${msg.name}: ${msg.content?.substring(0, 40) || 'empty'}...`);
          } else if (msg.content && msg.content.includes('access_token')) {
            console.log(`      ${idx + 1}. [USER] Credentials + "${directedRequest.substring(0, 50)}..."`);
          } else if (msg.content) {
            console.log(`      ${idx + 1}. [${msg.role.toUpperCase()}] "${msg.content.substring(0, 60)}..."`);
          } else {
            console.log(`      ${idx + 1}. [${msg.role.toUpperCase()}] (no content)`);
          }
        });
        
        console.log(`\n   🔧 MCP Tools Configuration:`);
        mcpTools.forEach((tool, idx) => {
          console.log(`      ${idx + 1}. ${tool.server_label}`);
          console.log(`         - URL: ${tool.server_url}`);
          console.log(`         - Headers: ${Object.keys(tool.headers || {}).length} header(s)`);
          if (tool.headers && Object.keys(tool.headers).length > 0) {
            Object.entries(tool.headers).forEach(([key, value]) => {
              // Sanitize sensitive headers
              const displayValue = key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')
                ? value.substring(0, 20) + '...'
                : value;
              console.log(`            ${key}: ${displayValue}`);
            });
          }
        });
        
        // Log the full request payload (with sanitized credentials)
        const requestPayload = {
          model: MODEL_INFERENCE,
          messages: messages.map(m => {
            const sanitized = { role: m.role };
            
            // Handle different message types
            if (m.content) {
              // Sanitize Salesforce credentials in user message
              if (m.content.includes('access_token')) {
                sanitized.content = '[SALESFORCE CREDENTIALS - REDACTED]';
              } else {
                sanitized.content = m.content;
              }
            }
            if (m.tool_calls) {
              sanitized.tool_calls = '[TOOL CALLS - REDACTED]';
            }
            if (m.tool_call_id) {
              sanitized.tool_call_id = m.tool_call_id;
            }
            if (m.name) {
              sanitized.name = m.name;
            }
            
            return sanitized;
          }),
          temperature: 0.1,
          // max_completion_tokens: 8192,
          top_p: 1,
          tools: mcpTools.map(t => ({
            ...t,
            headers: Object.keys(t.headers || {}).reduce((acc, key) => {
              acc[key] = key.toLowerCase().includes('token') ? '[REDACTED]' : t.headers[key];
              return acc;
            }, {})
          }))
        };
        
        console.log(`\n   📦 FULL REQUEST PAYLOAD (sanitized):`);
        console.log(JSON.stringify(requestPayload, null, 2));
        console.log(`${'='.repeat(80)}\n`);

        console.log(`⏳ Calling Groq API... (this may take a moment)\n`);
        
        // Broadcast API call progress
        if (progressCallback) {
          const toolNames = routingDecision.toolDetails && routingDecision.toolDetails.length > 0
            ? routingDecision.toolDetails.map(t => t.functions?.join(', ')).filter(Boolean).join(', ')
            : routingDecision.tools.join(', ');
          progressCallback(`Executing: ${toolNames}...`);
        }
        
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`   🆔 Request ID: ${requestId} (track this to detect duplicates)`);
        console.log(`   🔍 API Call Stack Trace:`);
        console.trace('   Groq API call initiated from:');

        // Retry logic for 500 errors
        const maxRetries = 3;
        let retryCount = 0;
        let completion = null;
        let lastError = null;
        
        while (retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff: 1s, 2s, 4s (max 5s)
              console.log(`   ⏳ Retry ${retryCount}/${maxRetries} after ${delay}ms delay...`);
              if (progressCallback) {
                progressCallback(`Retrying (${retryCount}/${maxRetries})...`);
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // Use the OpenAI client (matching Playground's working parameters)
            completion = await groqClient.chat.completions.create({
              model: MODEL_INFERENCE,
              messages: messages,
              temperature: 1, // Match Playground - temp 0 may cause issues with MCP
              max_completion_tokens: 32000, // Generous limit for complex MCP responses
              top_p: 1,
              "reasoning_effort": "medium",
              tools: mcpTools
            });
            
            console.log(`   ✅ API call completed for request: ${requestId}`);
            break; // Success! Exit retry loop
            
          } catch (error) {
            lastError = error;
            
            // Only retry on 500 errors
            if (error.status === 500 && retryCount < maxRetries) {
              console.warn(`   ⚠️ Groq API returned 500 error (attempt ${retryCount + 1}/${maxRetries + 1})`);
              retryCount++;
              continue;
            } else {
              // Non-500 error or max retries reached, throw the error
              throw error;
            }
          }
        }
        
        if (!completion) {
          console.error(`   ❌ All ${maxRetries + 1} attempts failed`);
          throw lastError;
        }

        const duration = Date.now() - startTime;
        console.log(`\n${'='.repeat(80)}`);
        console.log(`✅ GROQ API RESPONSE RECEIVED (${duration}ms)`);
        console.log(`   Response ID: ${completion.id || 'N/A'}`);
        console.log(`   Model: ${completion.model || 'N/A'}`);
        console.log(`   Finish Reason: ${completion.choices?.[0]?.finish_reason || 'N/A'}`);
        
        const message = completion.choices?.[0]?.message;
        if (message) {
          console.log(`   Message Role: ${message.role}`);
          console.log(`   Content Length: ${message.content?.length || 0} chars`);
          console.log(`   Tool Calls: ${message.tool_calls?.length || 0}`);
          
          if (message.tool_calls && message.tool_calls.length > 0) {
            console.log(`\n   🔧 Tool Calls Made:`);
            message.tool_calls.forEach((call, idx) => {
              console.log(`      ${idx + 1}. ${call.function?.name || 'unknown'}`);
              console.log(`         ID: ${call.id}`);
              if (call.function?.arguments) {
                console.log(`         Args: ${call.function.arguments.substring(0, 100)}${call.function.arguments.length > 100 ? '...' : ''}`);
              }
            });
          }
          
          if (message.content) {
            console.log(`\n   📄 Response Preview:`);
            const preview = message.content.substring(0, 200);
            console.log(`      ${preview}${message.content.length > 200 ? '...' : ''}`);
          }
        }
        
        // Log the full response object (useful for debugging)
        console.log(`\n   📦 FULL RESPONSE OBJECT:`);
        console.log(JSON.stringify(completion, null, 2));
        
        console.log(`${'='.repeat(80)}\n`);

        // Extract the final response from chat completion format
        finalResponse = completion.choices?.[0]?.message?.content || 'I used MCP tools but couldn\'t generate a response.';

        // Extract citations if present (for groq/compound and parallel_search)
        let citations = [];
        // Note: we already have 'message' variable from above, so we'll reuse it
        
        // Check for citations in various formats
        if (message?.citations) {
          citations = message.citations;
        } else if (message?.search_results?.results) {
          citations = message.search_results.results.map(r => ({
            title: r.title,
            url: r.url,
            content: r.content?.substring(0, 200) + (r.content?.length > 200 ? '...' : ''),
            score: r.score
          }));
        }

        // Track tool calls if present - Groq uses 'executed_tools' for MCP, not 'tool_calls'
        const toolCalls = completion.choices?.[0]?.message?.tool_calls || [];
        const executedTools = completion.choices?.[0]?.message?.executed_tools || [];
        
        console.log(`\n📊 TOOL EXECUTION SUMMARY:`);
        console.log(`   Standard tool_calls: ${toolCalls.length}`);
        console.log(`   Groq executed_tools (MCP): ${executedTools.length}`);
        
        // Process standard tool_calls format
        toolCalls.forEach(call => {
          console.log(`✅ MCP call (tool_calls): ${call.function?.name}`);
          toolsUsed.push({
            name: call.function?.name || 'unknown',
            success: true,
            category: 'mcp',
            server: 'Salesforce',
            citations: citations.length > 0 ? citations : undefined
          });
        });
        
        // Process Groq's executed_tools format (for MCP tools)
        // Track tool calls to detect duplicates
        const toolCallTracker = new Map();
        
        // Broadcast progress for each tool execution
        if (progressCallback && executedTools.length > 0) {
          const toolNames = executedTools.map(t => t.name?.replace('salesforce__', '').replace('sf_', '')).join(', ');
          progressCallback(`✓ Completed: ${toolNames}`);
        }
        
        executedTools.forEach((tool, idx) => {
          console.log(`✅ MCP call (executed_tools #${idx + 1}): ${tool.name}`);
          const parsedArgs = JSON.parse(tool.arguments || '{}');
          console.log(`   Tool arguments: ${JSON.stringify(parsedArgs, null, 2)}`);
          console.log(`   Tool output preview: ${tool.output?.substring(0, 200)}...`);
          
          // For ANY Salesforce create operation, extract and log the created record ID
          if (tool.name && tool.name.includes('sf_create_') && tool.output) {
            try {
              const idMatch = tool.output.match(/"id":\s*"([^"]+)"/);
              if (idMatch) {
                const recordType = tool.name.replace('salesforce__sf_create_', '').toUpperCase();
                console.log(`   📝 Created Salesforce ${recordType} ID: ${idMatch[1]}`);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
          
          // Detect duplicate calls by comparing tool name + stringified arguments
          const toolSignature = `${tool.name}::${JSON.stringify(parsedArgs)}`;
          if (toolCallTracker.has(toolSignature)) {
            console.warn(`   ⚠️⚠️⚠️ DUPLICATE TOOL CALL DETECTED: ${tool.name} called ${toolCallTracker.get(toolSignature) + 1} times with same arguments!`);
            console.warn(`   This means the AI model called the same function multiple times in a single response!`);
            console.warn(`   ⚠️ SKIPPING duplicate tool - not adding to toolsUsed array`);
            toolCallTracker.set(toolSignature, toolCallTracker.get(toolSignature) + 1);
            // Skip adding this duplicate to toolsUsed
            return;
          } else {
            toolCallTracker.set(toolSignature, 1);
          }
          
          toolsUsed.push({
            name: tool.name || 'unknown',
            success: true,
            category: 'mcp',
            server: 'Salesforce',
            citations: citations.length > 0 ? citations : undefined,
            executed_tool_index: tool.index
          });
        });
        
        // Log duplicate summary
        const duplicates = Array.from(toolCallTracker.entries()).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
          console.log(`\n⚠️ DUPLICATE TOOL CALLS SUMMARY:`);
          duplicates.forEach(([signature, count]) => {
            console.log(`   - ${signature.split('::')[0]}: called ${count} times (${count - 1} duplicate${count > 2 ? 's' : ''} removed)`);
          });
        }
        
        // If we have citations but no tool executions, add them to a general search result
        if (citations.length > 0 && toolCalls.length === 0 && executedTools.length === 0) {
          toolsUsed.push({
            name: 'web_search',
            success: true,
            category: 'search',
            citations: citations
          });
        }

      } catch (mcpError) {
        console.error('❌ MCP Responses API error:', mcpError);
        console.error('Error details:', mcpError.message);
        console.error('Error stack:', mcpError.stack);

        // Check if this was a 500 error after retries
        if (mcpError.status === 500) {
          console.error('💥 Groq API returned 500 error after all retries');
          console.error('   This is likely a temporary server issue');
          console.error('   Request ID:', mcpError.request_id);
        }

        // Try to get more details from the error
        let errorDetails = {};
        try {
          if (mcpError.message.includes('Groq API error:')) {
            const statusMatch = mcpError.message.match(/(\d+)/);
            if (statusMatch) {
              const status = parseInt(statusMatch[1]);
              errorDetails.status = status;

              if (status === 401 || status === 403) {
                console.error('💡 This might be an authentication issue - check GROQ_API_KEY');
              } else if (status === 404) {
                console.error('💡 This might be a model or endpoint issue - check model name');
              } else if (status >= 500) {
                console.error('💡 This might be a server-side issue with Groq');
              }
            }
          }
        } catch (parseError) {
          // Ignore parsing errors
        }

        // Check for common MCP issues in the error message
        if (mcpError.message?.includes('model') || mcpError.message?.includes('not supported')) {
          console.error('💡 This might be a model compatibility issue - MCP may not be supported by the current model');
        }

        // Fall back to built-in tools or direct answer
      }
    }

    // Execute built-in tools if no MCP tools were used or if MCP failed
    if (!finalResponse) {

      for (const toolName of routingDecision.tools) {
        try {
          const toolConfig = availableTools[toolName];
          if (!toolConfig) {
            continue;
          }

          if (toolConfig.type === 'mcp') {
            // MCP tool failed, try to provide a fallback response
            if (toolName === 'salesforce') {
              finalResponse = `I tried to access Salesforce but encountered a temporary issue the API (after multiple retries). Please try again in a moment. If the issue persists, the Groq API may be experiencing downtime.`;
            } else if (toolName === 'huggingface') {
              finalResponse = `I tried to search Hugging Face for trending models, but the tool is currently unavailable. You can visit https://huggingface.co/models?sort=trending to see the latest trending models directly.`;
            } else if (toolName === 'parallel_search') {
              finalResponse = `I tried to perform a web search, but the tool is currently unavailable. You can try searching directly on your preferred search engine.`;
            } else {
              finalResponse = `I tried to use the ${toolName} tool, but it's currently unavailable (after multiple retries). This may be a temporary Groq API issue.`;
            }
            toolsUsed.push({
              name: toolName,
              success: false,
              category: 'mcp',
              namespace: toolConfig.namespace,
              displayName: toolConfig.displayName,
              error: 'MCP tool unavailable'
            });
            continue;
          }

          if (toolConfig.type !== 'builtin') continue;

          let result;

          // Use the handler function from the registry
          if (toolConfig.handler) {
            // Special handling for weather tool to extract location
            if (toolName === 'weather') {
              const locationMatch = transcript.match(/(?:weather in|weather for)\s+([A-Za-z\s,]+)/i);
              const location = locationMatch ? locationMatch[1].trim() : 'San Francisco';
              result = await toolConfig.handler(location);
              result.location = location;
            } else {
              // Pass chatHistory AND contextStrategy to all builtin tools
              result = await toolConfig.handler(transcript, { 
                userName, 
                context, 
                chatHistory,
                contextStrategy: routingDecision.contextStrategy,
                isFollowUpQuestion: routingDecision.isFollowUpQuestion
              });
            }
          } else {
            console.warn(`No handler found for built-in tool: ${toolName}`);
            continue;
          }

          toolResults.push(result);
          toolsUsed.push({
            name: toolName,
            success: !result.error,
            category: toolConfig.category,
            namespace: toolConfig.namespace,
            displayName: toolConfig.displayName,
            location: result.location
          });

          // Combine responses
          if (finalResponse) {
            finalResponse += '\n\n';
          }
          finalResponse += result.response;

        } catch (toolError) {
          console.error(`Error executing built-in tool ${toolName}:`, toolError);
          toolsUsed.push({
            name: toolName,
            success: false,
            category: 'builtin',
            namespace: 'general',
            error: toolError.message
          });
        }
      }

      // If still no response, fall back to direct answer
      if (!finalResponse) {
        try {
          const directResult = await answerDirectly(transcript, { userName, context, chatHistory });
          finalResponse = directResult.response;
          toolsUsed.push({
            name: 'direct_answer',
            success: true,
            category: 'general',
            namespace: 'general',
            displayName: 'Direct Answer'
          });
        } catch (directError) {
          console.error('Direct answer fallback failed:', directError);
          finalResponse = "I'm sorry, I encountered an error processing your request. Please try again.";
        }
      }

      // If we have multiple built-in tools, create a summary response
      if (routingDecision.tools.length > 1 && toolResults.length > 1) {
        try {
          const summaryPrompt = `You are Zoom AI. The user asked: "${transcript}"

I used these tools: ${toolsUsed.map(t => t.name).join(', ')}

Tool results:
${toolResults.map((result, index) =>
  `Tool ${index + 1} (${result.tool}): ${result.response}`
).join('\n\n')}

Please provide a comprehensive, well-formatted response that synthesizes all this information for the user.`;

          const summaryResponse = await groqClient.chat.completions.create({
            model: MODEL_SYNTHESIS,
            messages: [
              {
                role: "system",
                content: summaryPrompt
              },
              {
                role: "user",
                content: "Please summarize and synthesize the tool results into a comprehensive response."
              }
            ]
          });

          finalResponse = summaryResponse.choices[0]?.message?.content || finalResponse;
          toolsUsed.push({
            name: 'response_synthesis',
            success: true,
            category: 'synthesis'
          });

        } catch (summaryError) {
          console.error('Error creating summary response:', summaryError);
          // Keep the combined response if summary fails
        }
      }
    }

    // Extract all citations from tools
    const allCitations = toolsUsed
      .filter(t => t.citations && t.citations.length > 0)
      .flatMap(t => t.citations);

    return {
      detected: true,
      response: finalResponse || "I processed your request but couldn't generate a response.",
      tools: toolsUsed,
      routing: routingDecision,
      context: context,
      chatHistoryLength: chatHistory.length,
      citations: allCitations.length > 0 ? allCitations : undefined
    };

  } catch (error) {
    console.error('Groq inference error:', error);
    return {
      detected: true,
      response: `Hello ${userName}! I detected your "Hey Zoom" trigger but encountered an error processing your request: ${transcript}`,
      error: error.message,
      tools: []
    };
  }
}


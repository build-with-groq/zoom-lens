# Hey Zoom & Discovery Mode Updates

## Overview

Major updates to both **Hey Zoom** (Action Feed) and **Discovery Mode** to make them more selective, cache-aware, and focused on their specific purposes.

## Summary of Changes

### 1. Hey Zoom (Action Feed) - Now Selective! ✅

**Before**:
- Always responded to every "hey zoom" trigger
- No memory of recent responses
- Could be repetitive and annoying

**After**:
- ✅ **Selective decision agent** - Decides whether to respond
- ✅ **Cache & queue management** - Won't repeat similar queries (15-min cache)
- ✅ **Router decisions visible** - See why it responded or skipped in action feed
- ✅ **Hey Zoom Toggle Support**:
  - **ON**: Bypasses decision agent (always responds)
  - **OFF**: Uses decision agent (selective responses)

### 2. Discovery Mode - Background Research Focus! 🔍

**Before**:
- Generic "discovery" without clear purpose
- No prioritization of tools
- Could be unfocused

**After**:
- ✅ **Background research focus** - Pulls info about people, companies, topics
- ✅ **Salesforce priority** - ANY person/company name → Salesforce lookup
- ✅ **Groq Compound for web** - Current info, trends, products, technologies
- ✅ **MCP-enabled** - Full access to Salesforce and other MCPs
- ✅ **Cache-aware** - Won't look up same person/company repeatedly (30-min cache)

---

## Hey Zoom Updates

### Architecture

```
User Message
    ↓
/api/trigger-groq
    ↓
Check Hey Zoom Toggle
    ├─→ ON: Skip decision agent, always respond
    └─→ OFF: Use decision agent
        ↓
    Check Cache/Queue (responseManager)
        ├─→ Cached: Skip (already responded)
        ├─→ Queued: Skip (currently processing)
        └─→ New: Evaluate with AI
            ↓
        Decision Agent (evaluateResponseNeed)
            ├─→ Should Respond: YES → Process
            └─→ Should Respond: NO → Skip
                ↓
    Broadcast Decision to Action Feed
        ↓
    Add to Queue → Process → Cache → Remove from Queue
```

### New Files

**`utils/heyzoom-decision-utils.js`**:
- `evaluateResponseNeed()` - AI-powered decision agent
- `ActionFeedManager` - Manages action feed messages
- `createActionFeedBroadcast()` - Format decisions for frontend

### Response Manager

Located in `main.js` (lines 239-243):

```javascript
const responseManager = new DiscoveryManager({
  cacheWindowMs: 15 * 60 * 1000,  // 15 minutes
  similarityThreshold: 0.85,       // 85% match required
  enableLogging: true
});
```

**Why 15 minutes?** Responses are more contextual and conversations move faster.

### Decision Agent Logic

The decision agent evaluates messages and decides:

**Should Respond To**:
- ✅ Direct questions asking for information
- ✅ Explicit requests for help or action
- ✅ Queries requiring tools (weather, search, Salesforce)
- ✅ Requests needing research or computation

**Should NOT Respond To**:
- ❌ Acknowledgments ("ok", "thanks", "got it")
- ❌ Casual conversation not directed at assistant
- ❌ Follow-up clarifications that don't need action
- ❌ Topics already responded to recently
- ❌ General statements or observations
- ❌ Conversation between other people

### Hey Zoom Toggle

Frontend can send `hey_zoom_enabled` flag in request body:

```javascript
// Frontend request
POST /api/trigger-groq
{
  "transcript": "hey zoom, what's the weather?",
  "hey_zoom_enabled": false,  // false = use decision agent
  // ... other fields
}
```

- **`true`**: Bypasses decision agent, always responds
- **`false`** (default): Uses decision agent, selective responses

### Action Feed Visibility

Router decisions are broadcast to the action feed:

```json
{
  "user_id": "zoom-ai-router",
  "user_name": "Router Decision",
  "data": "💭 Skipping: This is just an acknowledgment",
  "type": "router_decision",
  "metadata": {
    "shouldRespond": false,
    "confidence": 0.95,
    "cached": false,
    "queued": false,
    "transcript": "ok thanks"
  }
}
```

Icons:
- 🤖 = Responding
- 💭 = Skipping

### New API Endpoints

#### 1. Check Response Cache Status
```bash
GET /api/response/status

Response:
{
  "cache": {
    "count": 3,
    "items": [
      {
        "topic": "weather in san francisco",
        "age_seconds": 120,
        "age_minutes": 2
      }
    ]
  },
  "queue": { "count": 0, "items": [] },
  "config": {
    "cache_window_minutes": 15,
    "similarity_threshold": 0.85
  }
}
```

#### 2. Clear Response Cache
```bash
POST /api/response/clear-cache

Response:
{
  "success": true,
  "message": "Response cache and queue cleared"
}
```

#### 3. Get Action Feed
```bash
GET /api/action-feed?limit=20

Response:
{
  "decisions": [
    {
      "type": "router_decision",
      "timestamp": 1234567890,
      "shouldRespond": false,
      "reasoning": "Acknowledgment - no action needed",
      "confidence": 0.95,
      "transcript": "ok thanks"
    }
  ],
  "count": 10
}
```

#### 4. Clear Action Feed
```bash
POST /api/action-feed/clear

Response:
{
  "success": true,
  "message": "Action feed cleared"
}
```

### Console Output Examples

**Hey Zoom Toggle ON (Bypass)**:
```
🎛️ Hey Zoom Toggle: ON (bypass decision agent)

📋 Response Decision:
   Should Respond: YES ✅
   Reasoning: Hey Zoom toggle is ON - bypassing decision agent
   Confidence: 1.0
   Bypassed Decision Agent: true

🚀 About to call performGroqInference...
```

**Hey Zoom Toggle OFF (Selective - Skip)**:
```
🎛️ Hey Zoom Toggle: OFF (use decision agent)

🤔 EVALUATING RESPONSE NEED

📋 Response Decision:
   Should Respond: NO ⏭️
   Reasoning: This is just an acknowledgment, no action needed
   Confidence: 0.95
   Cached: false
   Queued: false

✅ Router Decision: SKIP
   Reasoning: This is just an acknowledgment, no action needed
   Confidence: 0.95

⏭️ Skipping response based on decision agent
```

**Hey Zoom Toggle OFF (Selective - Respond)**:
```
🎛️ Hey Zoom Toggle: OFF (use decision agent)

🤔 EVALUATING RESPONSE NEED

📋 Response Decision:
   Should Respond: YES ✅
   Reasoning: Direct question about weather requires tool usage
   Confidence: 0.95
   Cached: false
   Queued: false

✅ Router Decision: RESPOND
   Reasoning: Direct question about weather requires tool usage
   Confidence: 0.95

📥 Added to queue [q_123]: "hey zoom, what's the weather?"

🚀 About to call performGroqInference...

💾 Cached discovery: "hey zoom, what's the weather?"
📤 Removed from queue [q_123]
```

**Cache Hit**:
```
📋 Cache hit: "weather in sf" matches "what's the weather in san francisco" (87% similar)

📋 Response Decision:
   Should Respond: NO ⏭️
   Reasoning: Already responded to similar query recently (cached)
   Confidence: 1.0
   Cached: true

⏭️ Skipping response based on decision agent
```

---

## Discovery Mode Updates

### New Focus: Background Research

Discovery Mode is now specifically focused on **quiet, unobtrusive background research**:

1. **Person names** → Salesforce lookup
2. **Company names** → Salesforce + web search
3. **Products/technologies** → Web search (Groq Compound)
4. **Current events/trends** → Web search
5. **Locations** (context) → Maybe weather

### Salesforce Priority

The discovery decision agent now **prioritizes Salesforce** for any person or company name:

```
User: "I'm meeting with Bob Jones from Acme Corp tomorrow"

Discovery Decision:
✅ Should discover: true
   Topic: "Bob Jones at Acme Corp"
   Tool: salesforce
   Suggested Query: "search for Bob Jones at Acme Corp in Salesforce"
   Priority: high
   Rationale: Person and company name mentioned - pull background from CRM
```

### Updated Discovery Prompt

Key changes in `utils/discovery-cache-utils.js`:

**Before**:
- "Your job is to decide if we need to look up current/external information"
- Generic discovery without tool prioritization

**After**:
- "Your job is to proactively provide BACKGROUND INFORMATION about topics, people, and companies"
- **Available Research Tools** section with clear priorities:
  - **Salesforce (Priority)**: ANY person/company name
  - **Groq Compound**: Companies, topics, events, products
  - **Weather**: Explicit weather mentions only

### When Discovery Triggers

**Will Trigger**:
- ✅ "Bob mentioned X" → Look up X in Salesforce
- ✅ "Acme Corp" → Look up in Salesforce AND web
- ✅ "using React" → Web search for current info
- ✅ "the new AI model" → Web search
- ✅ "visiting SF office" → Maybe weather

**Won't Trigger**:
- ❌ Already cached/queued topics
- ❌ General conversation
- ❌ Acknowledgments or casual chat
- ❌ Info that doesn't need external data

### MCP Tools Enabled

Discovery Mode now has full access to MCPs:
- ✅ Salesforce (leads, contacts, accounts, opportunities)
- ✅ HuggingFace (AI models, datasets)
- ✅ Groq Compound (web search)
- ✅ Weather API

The `performGroqInference` function routes through the intelligent router, which will select the appropriate MCP tool based on the suggested query.

### Example Flow

**Scenario**: User mentions "We should reach out to Sarah at TechCorp"

1. **Discovery evaluates** → "Sarah at TechCorp" (person + company)
2. **Decision**: `should_discover: true, tool: "salesforce"`
3. **Suggested query**: "search for Sarah contact at TechCorp company"
4. **Router selects**: Salesforce MCP (sf_search_leads + sf_search_accounts)
5. **Result**: Background info about Sarah and TechCorp pulled from CRM
6. **Distills**: "Sarah Johnson is VP of Engineering at TechCorp, last contacted 2 weeks ago"
7. **Caches**: "Sarah at TechCorp" (30 minutes)

---

## Configuration

### Response Manager (Hey Zoom)
```javascript
// main.js lines 239-243
const responseManager = new DiscoveryManager({
  cacheWindowMs: 15 * 60 * 1000,    // 15 minutes
  similarityThreshold: 0.85,         // 85% match
  enableLogging: true
});
```

### Discovery Manager
```javascript
// main.js lines 231-235
const discoveryManager = new DiscoveryManager({
  cacheWindowMs: 30 * 60 * 1000,    // 30 minutes
  similarityThreshold: 0.8,          // 80% match
  enableLogging: true
});
```

### Action Feed Manager
```javascript
// main.js lines 246-249
const actionFeedManager = new ActionFeedManager({
  enableLogging: true,
  maxMessages: 100
});
```

### Why Different Cache Windows?

| System | Cache Window | Reason |
|--------|-------------|---------|
| Hey Zoom | 15 min | Responses are contextual, conversations move fast |
| Discovery | 30 min | Background research is less time-sensitive |

---

## Testing

### Test Hey Zoom Decision Agent

1. **Test Acknowledgment (Should Skip)**:
```bash
POST /api/trigger-groq
{
  "transcript": "ok thanks",
  "hey_zoom_enabled": false,
  "user_name": "Test User",
  "chat_history": []
}

Expected: skipped=true, reasoning="Acknowledgment"
```

2. **Test Direct Question (Should Respond)**:
```bash
POST /api/trigger-groq
{
  "transcript": "hey zoom, what's the weather in SF?",
  "hey_zoom_enabled": false,
  "user_name": "Test User",
  "chat_history": []
}

Expected: success=true, response with weather data
```

3. **Test Hey Zoom Toggle ON**:
```bash
POST /api/trigger-groq
{
  "transcript": "ok thanks",
  "hey_zoom_enabled": true,
  "user_name": "Test User",
  "chat_history": []
}

Expected: success=true, bypassed decision agent
```

4. **Test Cache Hit**:
```bash
# First request
POST /api/trigger-groq
{ "transcript": "weather in SF", "hey_zoom_enabled": false }

# Second request (similar)
POST /api/trigger-groq
{ "transcript": "what's the weather in san francisco", "hey_zoom_enabled": false }

Expected: skipped=true, reasoning="Already responded to similar query"
```

### Test Discovery Background Research

1. **Test Person Name Lookup**:
```
User message: "I'm meeting with Bob Jones tomorrow"

Expected:
- Discovery triggers
- Tool: salesforce
- Suggested query: "search for Bob Jones in Salesforce"
- Result: Background info from CRM
```

2. **Test Company Lookup**:
```
User message: "Tell me about Acme Corp"

Expected:
- Discovery triggers
- Tool: salesforce (or groq_compound)
- Suggested query: "search for Acme Corp"
- Result: Company background from CRM/web
```

3. **Test Technology Lookup**:
```
User message: "We should use React for this project"

Expected:
- Discovery triggers
- Tool: groq_compound
- Suggested query: "current information about React framework"
- Result: Latest React info from web
```

4. **Test Cache Prevention**:
```
# First message
User: "Tell me about Salesforce"
→ Discovers and caches

# Second message (within 30 min)
User: "What about Salesforce?"
→ Skipped (cache hit)
```

### API Testing

```bash
# Check response cache
curl http://localhost:9995/api/response/status

# Check discovery cache
curl http://localhost:9995/api/discovery/status

# Get action feed
curl http://localhost:9995/api/action-feed?limit=10

# Clear caches (testing)
curl -X POST http://localhost:9995/api/response/clear-cache
curl -X POST http://localhost:9995/api/discovery/clear-cache
curl -X POST http://localhost:9995/api/action-feed/clear
```

---

## Migration Notes

### Breaking Changes
None! All changes are backward compatible.

### New Dependencies
- `utils/heyzoom-decision-utils.js` (new file)
- No external dependencies

### Frontend Changes Required

**Optional**: Send `hey_zoom_enabled` flag in `/api/trigger-groq` requests:

```javascript
// Add to request body
{
  transcript: "...",
  hey_zoom_enabled: heyZoomToggle,  // true/false from UI toggle
  // ... other fields
}
```

**Optional**: Listen for router decision messages in action feed:

```javascript
// SSE listener
if (message.type === 'router_decision') {
  console.log(`Router: ${message.data}`);
  // Show in action feed UI
}
```

---

## Summary

### Hey Zoom (Action Feed)
- ✅ Selective decision agent with cache/queue
- ✅ Router decisions visible in action feed
- ✅ Toggle support (ON = always, OFF = selective)
- ✅ 15-minute response cache

### Discovery Mode
- ✅ Background research focus
- ✅ Salesforce priority for person/company names
- ✅ MCP-enabled (full tool access)
- ✅ 30-minute discovery cache

### Benefits
- 🎯 More selective and less annoying
- 💾 Won't repeat same queries
- 👁️ Transparent decision-making
- 🔍 Focused background research
- ⚡ Faster responses (cache hits)
- 📊 Trackable via API endpoints

**Result**: Both systems are now smarter, more focused, and respect the user's conversational flow!

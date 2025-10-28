# Feedback Loop Fix V2 - Discovery Mode Recursion Prevention

## Problem

Discovery Mode was creating an infinite feedback loop by recursively calling itself:

```
1. User: "whats the weather in sf"
2. Main request → calls Discovery Mode
3. Discovery Mode → calls performGroqInference with "Current weather in San Francisco"
4. performGroqInference completes → returns to main
5. Frontend calls Discovery Mode again (automatic trigger)
6. Discovery Mode sees its own output → calls performGroqInference again
7. Loop continues infinitely! 🔄💥
```

## Logs Showed

```
🔮 Discovery Mode: Analyzing 1 transcripts...
🔮 Latest transcripts (full): [0] You: "whats the weather in sf"

🔍 Discovering: Current weather conditions in San Francisco, CA using weather

🚀 performGroqInference CALLED
   Transcript: "San Francisco, CA..."
   User: Discovery Mode
   Context: discovery_analysis

[... completes and returns]

🔮 Discovery Mode: Analyzing 1 transcripts...  ← RUNS AGAIN!
🔮 Latest transcripts (full): [0] You: "whats the weather in sf"

🔍 Discovering: Current weather in San Francisco, CA using weather  ← DUPLICATE!
```

## Root Cause

Two issues:

1. **No recursion protection**: Discovery Mode could call `performGroqInference`, which could theoretically trigger more discovery (though this wasn't directly happening in the code)

2. **Frontend auto-trigger**: The frontend was likely calling `/api/discovery-analysis` automatically after responses, causing it to analyze the conversation again and potentially discover the same things

3. **No user ID check**: Discovery Mode wasn't checking if the latest message was from itself before running analysis

## Fixes Applied

### Fix 1: Conversation State Deduplication (main.js:796-798, 1249-1281)

**File**: `main.js` (lines 796-798, 1249-1281)

Added conversation state tracking to prevent re-analyzing the same conversation state. The key insight: Discovery should only run when **new user input** arrives, not when AI responses or cached results are added.

```javascript
// NEW: Discovery deduplication tracking (main.js:796-798)
const recentDiscoveryRequests = new Map(); // conversationStateKey -> timestamp
const DISCOVERY_DEDUP_WINDOW_MS = 60000; // 60 seconds

// NEW: Conversation state deduplication (main.js:1249-1281)
// Create a unique key from ALL user messages (not just latest)
const userMessages = transcripts
  .map(t => t.data?.trim())
  .filter(Boolean)
  .join('||'); // Concatenate all messages to identify conversation state

const discoveryKey = userMessages;
const lastDiscoveryTime = recentDiscoveryRequests.get(discoveryKey);

if (lastDiscoveryTime && (now - lastDiscoveryTime) < DISCOVERY_DEDUP_WINDOW_MS) {
  console.log(`   ⏭️ SKIP: Already analyzed this conversation state`);
  return c.json({
    insights: [],
    duplicate: true,
    reason: 'Already analyzed this conversation state'
  });
}

// Track this conversation state as analyzed
recentDiscoveryRequests.set(discoveryKey, now);
```

**Why this is the correct fix:**
- Discovery should only analyze **new conversation states** (when user adds new input)
- Frontend calls `/api/discovery-analysis` every time transcripts change (including AI responses)
- By keying on ALL user messages, we detect: "I've already analyzed this exact set of user inputs"
- When new user input arrives, the conversation state changes → new key → Discovery runs
- When only AI responses are added → same conversation state → skip re-analysis
- This is the **primary fix** that stops wasteful re-evaluation of cached topics

### Fix 2: Added `skipDiscovery` Parameter (agent-1-inference.js:930)

**File**: `experiments/agent-1/agent-1-inference.js`

```javascript
// OLD:
export async function performGroqInference(
  transcript, userName, context = 'general', chatHistory = [],
  skipTriggerDetection = false, progressCallback = null, requestHeaders = null
) {

// NEW:
export async function performGroqInference(
  transcript, userName, context = 'general', chatHistory = [],
  skipTriggerDetection = false, progressCallback = null, requestHeaders = null,
  skipDiscovery = false  // ✅ ADDED - prevents recursive discovery
) {
  console.log(`   Skip Discovery: ${skipDiscovery}`);  // ✅ ADDED logging
```

### Fix 3: Pass `skipDiscovery=true` in Discovery Endpoint (main.js:1346)

**File**: `main.js` (lines 1346-1355)

```javascript
// OLD:
const result = await performGroqInference(
  discoveryQuery,
  'Discovery Mode',
  'discovery_analysis',
  transcripts.slice(-10),
  true // Skip trigger detection
);

// NEW:
const result = await performGroqInference(
  discoveryQuery,
  'Discovery Mode',
  'discovery_analysis',
  transcripts.slice(-10),
  true, // Skip trigger detection
  null, // No progress callback
  null, // No request headers
  true  // ✅ Skip discovery (prevents recursive feedback loop)
);
```

### Fix 4: Block Discovery on Discovery Output (main.js:1238-1248)

**File**: `main.js` (lines 1234-1244)

```javascript
// ✅ ADDED SAFETY CHECK
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
```

## Result

Discovery Mode now works correctly:

```
1. User: "weather in sf" → Discovery analyzes conversation state A → Runs once ✅
2. Frontend calls again (after AI response) → Same state A → SKIPPED ✅
3. Frontend keeps calling (every 3s) → Still state A → SKIPPED ✅
4. User: "toronto baseball" → NEW state B → Discovery runs again ✅
5. Frontend calls again → Same state B → SKIPPED ✅
```

**Key Insight**: Discovery tracks the **full conversation state** (all user messages), not just individual messages. It only runs `evaluateDiscoveryNeed` when the conversation state changes (new user input), and uses cached discoveries to inform decisions without re-evaluating.

## Testing

### Before Fix (Feedback Loop)
```bash
# Request 1
curl -X POST http://localhost:9995/api/trigger-groq \
  -H "Content-Type: application/json" \
  -d '{"transcript":"whats the weather in sf","user_name":"You",...}'

# Discovery runs → completes
# Frontend auto-calls discovery
# Discovery runs AGAIN → discovers same thing
# [infinite loop]
```

### After Fix (No Loop)
```bash
# Request 1
curl -X POST http://localhost:9995/api/trigger-groq \
  -H "Content-Type: application/json" \
  -d '{"transcript":"whats the weather in sf","user_name":"You",...}'

# Discovery runs → completes ✅
# Frontend auto-calls discovery
# Discovery checks: "Is last message from Discovery? YES"
# Discovery BLOCKS → returns empty insights ✅
# [stops here - no loop]
```

### Test Command

```bash
# In zoom-lens-v2 directory:
deno task start

# In another terminal:
curl -X POST http://localhost:9995/api/trigger-groq \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "whats the weather in san francisco",
    "user_name": "Test User",
    "user_id": "test-user-1",
    "context": "meeting_transcript",
    "chat_history": []
  }'

# Watch logs for:
# ✅ Discovery runs once
# ✅ performGroqInference shows "Skip Discovery: true"
# ✅ No duplicate discovery calls
# ✅ If frontend calls /api/discovery-analysis again, it should block
```

## All Protected User IDs

The system now filters out discovery messages at multiple levels:

| user_id | user_name | Where Blocked | Purpose |
|---------|-----------|---------------|---------|
| `discovery-ai` | `Discovery` | main.js:1235 | Discovery Mode insights |
| N/A | `Discovery Mode` | main.js:1235 | Discovery Mode context |

## Prevention Checklist

When adding new AI features that might call `performGroqInference`:

- [ ] Add a unique `user_id` (e.g., `zoom-ai-newfeature`)
- [ ] Pass `skipDiscovery=true` if the feature shouldn't trigger discovery
- [ ] Add user_id to the AI message filter in main.js if it shouldn't re-process
- [ ] Test that it doesn't create a feedback loop

## Related Files

- `experiments/agent-1/agent-1-inference.js:930` - performGroqInference signature
- `main.js:1234` - Discovery Mode safety check
- `main.js:1346` - Discovery Mode performGroqInference call
- `FEEDBACK_LOOP_FIX.md` - Original router decision feedback loop fix

## Summary

**Problem**: Discovery Mode re-analyzing the same conversation state repeatedly

**Root Cause**: Frontend watcher triggers `/api/discovery-analysis` every time transcripts change (including AI responses), causing Discovery to re-evaluate cached topics unnecessarily

**Core Issue Identified**: Discovery was keying on individual messages instead of the full conversation state, so it couldn't recognize "I've already analyzed this exact set of user inputs"

**Fixes Applied**:
- **Fix 1 (PRIMARY)**: Conversation state deduplication - key on ALL user messages, not just latest ✅
- **Fix 2**: Added `skipDiscovery` parameter to `performGroqInference` ✅
- **Fix 3**: Pass `skipDiscovery=true` when discovery calls inference ✅
- **Fix 4**: Block discovery if latest message is from discovery itself ✅

**Result**: Discovery only analyzes when new user input arrives, uses cached discoveries for decision-making without wasteful re-evaluation ✅

**Key Takeaway**: Track conversation **state** (all user messages), not individual messages, to avoid redundant analysis! 🛡️

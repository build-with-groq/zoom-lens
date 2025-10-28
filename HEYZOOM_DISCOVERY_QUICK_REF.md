# Hey Zoom & Discovery - Quick Reference

## Quick Summary

**Hey Zoom**: Now selective! Won't respond to acknowledgments like "ok thanks". Cache prevents repeats.

**Discovery**: Background research focused! Prioritizes Salesforce for person/company names.

---

## Hey Zoom Quick Commands

### Check Status
```bash
# Check what's cached
curl http://localhost:9995/api/response/status

# Get recent router decisions
curl http://localhost:9995/api/action-feed?limit=10

# Clear cache (testing)
curl -X POST http://localhost:9995/api/response/clear-cache
```

### Hey Zoom Toggle

**Frontend Request**:
```javascript
{
  "transcript": "hey zoom, what's the weather?",
  "hey_zoom_enabled": false,  // false = selective, true = always respond
  // ... other fields
}
```

- **`false`** (default): Uses decision agent, selective
- **`true`**: Bypasses decision agent, always responds

### Configuration (main.js lines 239-243)

```javascript
const responseManager = new DiscoveryManager({
  cacheWindowMs: 15 * 60 * 1000,    // 15 minutes
  similarityThreshold: 0.85,         // 85% match
  enableLogging: true
});
```

### What Hey Zoom Responds To

✅ **Will Respond**:
- Direct questions
- Explicit requests for help
- Tool usage queries (weather, search, Salesforce)
- Research/computation needs

❌ **Won't Respond**:
- "ok thanks", "got it", "alright"
- Casual conversation not directed at AI
- Topics already responded to (cached)
- General observations

---

## Discovery Quick Commands

### Check Status
```bash
# Check what's discovered
curl http://localhost:9995/api/discovery/status

# Clear cache (testing)
curl -X POST http://localhost:9995/api/discovery/clear-cache
```

### Configuration (main.js lines 231-235)

```javascript
const discoveryManager = new DiscoveryManager({
  cacheWindowMs: 30 * 60 * 1000,    // 30 minutes
  similarityThreshold: 0.8,          // 80% match
  enableLogging: true
});
```

### What Discovery Looks Up

✅ **Will Discover**:
- **Person names** → Salesforce lookup
- **Company names** → Salesforce + web search
- **Products/tech** → Web search (Groq Compound)
- **Current events** → Web search
- **Locations** → Maybe weather

❌ **Won't Discover**:
- Already cached/queued topics
- General conversation
- Acknowledgments
- Info that doesn't need external data

### Tool Priority

1. **Salesforce** (PRIORITY) - ANY person/company name
2. **Groq Compound** - Web search for everything else
3. **Weather** - Only explicit weather mentions

---

## Console Output Quick Guide

### Hey Zoom Decision (Skip)
```
🎛️ Hey Zoom Toggle: OFF (use decision agent)
📋 Response Decision:
   Should Respond: NO ⏭️
   Reasoning: This is just an acknowledgment
   Confidence: 0.95
⏭️ Skipping response based on decision agent
```

### Hey Zoom Decision (Respond)
```
🎛️ Hey Zoom Toggle: OFF (use decision agent)
📋 Response Decision:
   Should Respond: YES ✅
   Reasoning: Direct question requiring tools
   Confidence: 0.95
📥 Added to queue [q_123]: "what's the weather?"
🚀 About to call performGroqInference...
💾 Cached discovery: "what's the weather?"
📤 Removed from queue [q_123]
```

### Discovery (Person Lookup)
```
🔮 Discovery Mode: Analyzing 3 transcripts...
🤔 Evaluating discovery need with cache/queue awareness...
📋 Discovery decision:
   should_discover: true
   Tool: salesforce
   Topic: "Bob Jones at Acme Corp"
   Rationale: Person and company name - pull from CRM
🔍 Discovering: Bob Jones at Acme Corp using salesforce
💾 Cached discovery: "Bob Jones at Acme Corp"
```

### Cache Hit
```
📋 Cache hit: "weather in sf" matches "weather in san francisco" (87% similar)
⏭️ Skipped 1 insights (already cached/queued):
   - "weather in sf" (already_cached)
ℹ️ No discovery insights needed
```

---

## API Endpoints

### Hey Zoom / Response Manager

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/response/status` | GET | Check response cache & queue |
| `/api/response/clear-cache` | POST | Clear response cache |
| `/api/action-feed` | GET | Get router decisions |
| `/api/action-feed/clear` | POST | Clear action feed |

### Discovery Mode

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/discovery/status` | GET | Check discovery cache & queue |
| `/api/discovery/clear-cache` | POST | Clear discovery cache |
| `/api/discovery-analysis` | POST | Trigger discovery analysis |

---

## Testing Scenarios

### Test 1: Hey Zoom Acknowledgment (Should Skip)
```
Input: "ok thanks"
Expected: Skipped, reasoning="Acknowledgment"
```

### Test 2: Hey Zoom Direct Question (Should Respond)
```
Input: "hey zoom, what's the weather?"
Expected: Responds with weather
```

### Test 3: Hey Zoom Cache Hit (Should Skip)
```
1. Input: "weather in SF"
2. Input: "what's the weather in San Francisco" (within 15 min)
Expected: Second skipped (cache hit)
```

### Test 4: Discovery Person Lookup
```
Input: "I'm meeting with Bob Jones tomorrow"
Expected: Discovers via Salesforce
```

### Test 5: Discovery Cache Hit
```
1. Input: "Tell me about Salesforce"
2. Input: "What about Salesforce?" (within 30 min)
Expected: Second skipped (cache hit)
```

---

## Tuning

### Make Hey Zoom More Selective
```javascript
similarityThreshold: 0.9  // 90% match (stricter)
```

### Make Hey Zoom Less Selective
```javascript
similarityThreshold: 0.75  // 75% match (looser)
```

### Longer Response Cache
```javascript
cacheWindowMs: 30 * 60 * 1000  // 30 minutes
```

### Shorter Response Cache
```javascript
cacheWindowMs: 10 * 60 * 1000  // 10 minutes
```

---

## Troubleshooting

### Problem: Hey Zoom responding to everything
- Check `hey_zoom_enabled` is `false` in requests
- Check logs for "Bypassed Decision Agent: true"
- Check cache similarity threshold (try 0.85)

### Problem: Hey Zoom not responding at all
- Check if cached (curl `/api/response/status`)
- Check decision reasoning in logs
- Check similarity threshold (try 0.75)

### Problem: Discovery not finding people in Salesforce
- Check Salesforce MCP is configured
- Check credentials are set
- Check logs for "Tool: salesforce"

### Problem: Cache not working
- Check logs for "Cache hit" messages
- Check similarity threshold
- Check cache window hasn't expired

---

## Files Modified

### New Files
- `utils/heyzoom-decision-utils.js` - Decision agent & action feed

### Modified Files
- `main.js` - Added response manager, action feed, decision logic
- `utils/discovery-cache-utils.js` - Updated for background research focus

### Documentation
- `HEYZOOM_AND_DISCOVERY_UPDATES.md` - Complete guide
- `HEYZOOM_DISCOVERY_QUICK_REF.md` - This file

---

## Key Takeaways

1. **Hey Zoom** is now selective - won't spam responses
2. **Discovery** focuses on background research - people, companies, topics
3. **Salesforce** is priority for any person/company name
4. **Cache** prevents repetitive lookups (15 min Hey Zoom, 30 min Discovery)
5. **Router decisions** visible in action feed
6. **Toggle support** for Hey Zoom ON/OFF behavior

**Result**: Smarter, more focused, less annoying! 🎉

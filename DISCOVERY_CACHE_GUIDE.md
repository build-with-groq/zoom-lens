# Discovery Cache System Guide

## Overview

The Discovery Mode now includes a sophisticated **cache and queue management system** that prevents it from repeatedly looking up the same information. This makes Discovery Mode much more selective and efficient.

## Problem Solved

**Before**: Discovery Mode would:
- Look up the same topic multiple times
- Process duplicate concurrent requests
- Have no memory of what it already discovered
- Be too "excited" and redundant with searches

**After**: Discovery Mode now:
- ✅ Remembers what it looked up (30-minute cache)
- ✅ Prevents duplicate concurrent searches (queue management)
- ✅ Checks cache before triggering new discoveries
- ✅ Shows you what's cached and queued
- ✅ Uses fuzzy matching (80% similarity threshold)

## Architecture

### Components

1. **DiscoveryManager** (`utils/discovery-cache-utils.js`)
   - Manages cache and queue
   - Tracks what's been discovered
   - Tracks what's currently being processed
   - Automatic cleanup of stale entries

2. **Cache System**
   - Stores discoveries for 30 minutes (configurable)
   - Fuzzy topic matching (80% similarity)
   - Normalized comparison (lowercase, sorted words)
   - Auto-expires old entries

3. **Queue System**
   - Prevents duplicate concurrent searches
   - Tracks in-progress discoveries
   - Removes items when done
   - Shows what's being processed

4. **Enhanced Filtering** (`evaluateDiscoveryNeed`)
   - Checks cache before suggesting discoveries
   - Checks queue before suggesting discoveries
   - Provides "already cached/queued" reasons
   - Very selective about what to discover

## How It Works

### Flow Diagram

```
User Message
    ↓
Discovery Endpoint
    ↓
Show Cache/Queue Status (logs)
    ↓
evaluateDiscoveryNeed()
    ├─→ Check cache (already discovered?)
    ├─→ Check queue (currently processing?)
    └─→ AI Decision (with cache/queue context)
    ↓
Should Discover?
    ├─→ NO → Return empty, show cache summary
    └─→ YES → Continue
        ↓
    Add to Queue
        ↓
    Perform Discovery (MCP/tools)
        ↓
    Cache Result
        ↓
    Remove from Queue
        ↓
    Return Result + Cache Summary
```

### Example Scenario

**Conversation:**
```
User: "What's Salesforce's stock price?"
→ Discovery looks up Salesforce stock price
→ Caches: "Salesforce stock price"

User: "And what about their revenue?"
→ Discovery looks up Salesforce revenue
→ Caches: "Salesforce revenue"

User: "Tell me more about Salesforce's stock"
→ Discovery checks cache
→ Finds "Salesforce stock price" (85% match)
→ SKIPS - already cached!
```

### Cache Matching Logic

Topics are normalized for fuzzy matching:

```javascript
"Salesforce stock price"
→ "price salesforce stock" (lowercase, sorted)

"salesforce Stock PRICE!"
→ "price salesforce stock" (same!)

Similarity: 100% ✅ Match!
```

Similar topics also match:

```javascript
"Salesforce stock price" vs "Stock price for Salesforce"
→ 80%+ similarity ✅ Match!
```

## Configuration

### In `main.js`

```javascript
const discoveryManager = new DiscoveryManager({
  cacheWindowMs: 30 * 60 * 1000,  // 30 minutes
  similarityThreshold: 0.8,        // 80% match required
  enableLogging: true              // Verbose console output
});
```

### Adjustable Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `cacheWindowMs` | 30 min | How long to keep discoveries cached |
| `similarityThreshold` | 0.8 | Minimum similarity to match topics (0-1) |
| `enableLogging` | true | Show detailed logs in console |

## API Endpoints

### 1. Check Discovery Status

```bash
GET /api/discovery/status
```

**Response:**
```json
{
  "cache": {
    "count": 3,
    "items": [
      {
        "topic": "Salesforce stock price",
        "age_seconds": 120,
        "age_minutes": 2
      },
      {
        "topic": "Weather in San Francisco",
        "age_seconds": 300,
        "age_minutes": 5
      }
    ]
  },
  "queue": {
    "count": 1,
    "items": [
      {
        "topic": "HuggingFace models",
        "age_seconds": 5
      }
    ]
  },
  "config": {
    "cache_window_minutes": 30,
    "similarity_threshold": 0.8
  },
  "timestamp": 1234567890
}
```

### 2. Clear Cache (Debugging)

```bash
POST /api/discovery/clear-cache
```

**Response:**
```json
{
  "success": true,
  "message": "Discovery cache and queue cleared",
  "timestamp": 1234567890
}
```

## Console Output

### Normal Operation

```
🔮 Discovery Mode: Analyzing 5 transcripts...

📊 Discovery Status:

💾 Cached (2):
   1. Salesforce stock price (3m ago)
   2. Weather in SF (10m ago)

⏳ Queued (0):
   (nothing queued)

🤔 Evaluating discovery need with cache/queue awareness...

📋 Discovery decision: {
  should_discover: false,
  insights_count: 0,
  skipped_count: 1,
  reasoning: "Topic already discovered recently"
}

⏭️ Skipped 1 insights (already cached/queued):
   - "salesforce stock" (already_cached)

ℹ️ No discovery insights needed
```

### When Discovering

```
🔮 Discovery Mode: Analyzing 3 transcripts...

📊 Discovery Status:

💾 Cached (0):
   (nothing cached yet)

⏳ Queued (0):
   (nothing queued)

🤔 Evaluating discovery need with cache/queue awareness...

📋 Discovery decision: {
  should_discover: true,
  insights_count: 1,
  skipped_count: 0
}

🔮 Processing 1 insight(s)

📥 Added to queue [q_1]: "Salesforce revenue 2024"
   Queue size: 1

🔍 Discovering: Salesforce revenue 2024 using groq_compound

📝 Re-processing findings for background research presentation...
📝 Second distillation pass to ensure brevity...

💾 Cached discovery: "Salesforce revenue 2024"
   Cache size: 1

📤 Removed from queue [q_1]: "Salesforce revenue 2024"
   Queue size: 0

✅ Generated 1 discovery insight(s)

📊 Discovery Status:

💾 Cached (1):
   1. Salesforce revenue 2024 (0m ago)

⏳ Queued (0):
   (nothing queued)
```

## Testing

### 1. Check Status

```bash
curl http://localhost:9995/api/discovery/status
```

### 2. Test Cache Hit

1. Send message: "What's Salesforce's stock price?"
2. Wait for discovery to complete
3. Send similar message: "Tell me about Salesforce stock"
4. Check logs → Should skip (cache hit)

### 3. Test Queue Prevention

1. Send message with discovery trigger
2. Immediately send another similar message
3. Second request should skip (queue hit)

### 4. Clear Cache for Testing

```bash
curl -X POST http://localhost:9995/api/discovery/clear-cache
```

## Monitoring

### Key Metrics to Watch

1. **Cache Hit Rate**: How often discoveries are skipped due to cache
2. **Queue Blocks**: How often duplicate concurrent requests are prevented
3. **Cache Size**: Number of items cached (should stay reasonable)
4. **Queue Size**: Should mostly be 0-1 (items process quickly)

### Health Indicators

**Good:**
- Cache hit rate: 20-40%
- Queue mostly empty
- Few duplicate discoveries

**Needs Tuning:**
- Cache hit rate: <10% (threshold too high)
- Cache hit rate: >60% (window too long)
- Queue growing (something stuck)

## Tuning Guide

### Cache Window Too Long?

**Symptom**: Discoveries feel stale, information outdated

**Fix**: Reduce `cacheWindowMs`
```javascript
cacheWindowMs: 15 * 60 * 1000  // 15 minutes instead of 30
```

### Cache Window Too Short?

**Symptom**: Too many repeat discoveries, cache not helping

**Fix**: Increase `cacheWindowMs`
```javascript
cacheWindowMs: 60 * 60 * 1000  // 1 hour instead of 30 minutes
```

### Similarity Too Strict?

**Symptom**: Similar topics not matching, duplicates still happening

**Fix**: Lower `similarityThreshold`
```javascript
similarityThreshold: 0.7  // 70% match instead of 80%
```

### Similarity Too Loose?

**Symptom**: Different topics incorrectly matching

**Fix**: Increase `similarityThreshold`
```javascript
similarityThreshold: 0.9  // 90% match instead of 80%
```

## Advanced Usage

### Manual Cache Management

```javascript
// Check if topic is cached
const cached = discoveryManager.wasRecentlyDiscovered('salesforce stock');

// Get cached result
const result = discoveryManager.getCachedDiscovery('salesforce stock');

// Manually cache a result
discoveryManager.cacheDiscovery('custom topic', {
  data: 'custom data',
  timestamp: Date.now()
});

// Check queue
const queued = discoveryManager.isInQueue('salesforce stock');

// Get summary
const summary = discoveryManager.getSummary();
console.log(summary);
```

### Using with Other Agents

The DiscoveryManager can be used by other agents too:

```javascript
import { DiscoveryManager } from './utils/discovery-cache-utils.js';

const agentCache = new DiscoveryManager({
  cacheWindowMs: 10 * 60 * 1000,  // 10 minutes for agent
  similarityThreshold: 0.85
});

// Before making expensive API call
if (!agentCache.wasRecentlyDiscovered(topic)) {
  const queueId = agentCache.addToQueue(topic);
  const result = await expensiveOperation(topic);
  agentCache.cacheDiscovery(topic, result);
  agentCache.removeFromQueue(queueId);
}
```

## Troubleshooting

### Cache Not Working?

**Check:**
1. Is logging enabled? Look for cache status in logs
2. Is similarity threshold too high? (try 0.7)
3. Are topics being normalized properly? (check logs)

### Queue Growing?

**Check:**
1. Are discoveries completing? (look for "remove from queue" logs)
2. Are errors being caught? (queue cleanup on error)
3. Is there an infinite loop?

### Too Many Cache Hits?

**Check:**
1. Is cache window too long? (try 15 minutes)
2. Is similarity threshold too low? (try 0.85)
3. Are topics too generic? (e.g., "information", "search")

## Best Practices

1. **Monitor Logs**: The console output shows everything happening
2. **Check Status**: Use `/api/discovery/status` to see what's cached
3. **Clear on Deploy**: Clear cache when deploying changes
4. **Tune Thresholds**: Adjust based on your use case
5. **Watch Queue**: If queue grows, something is stuck

## Future Enhancements

Potential improvements:

1. **Persistent Cache**: Store cache in database across restarts
2. **User-Specific Cache**: Different cache per user
3. **Priority Queue**: Process high-priority discoveries first
4. **Cache Warming**: Pre-load common topics
5. **Analytics**: Track cache hit rates, popular topics
6. **Smart Expiry**: Expire based on topic type (news = 5 min, stock = 30 min)

## Summary

The Discovery Cache System makes Discovery Mode:
- **Selective**: Only discovers what's truly new
- **Efficient**: Skips redundant lookups
- **Transparent**: Shows what's cached and queued
- **Synchronous**: Prevents duplicate concurrent requests
- **Smart**: Uses fuzzy matching to catch variations

This solves the "too excited" problem while maintaining helpful proactive insights!

# Discovery Cache - Quick Reference

## What Changed?

Discovery Mode now has **memory** and won't repeat itself!

## Key Features

✅ **30-minute cache** - Remembers discoveries for 30 minutes
✅ **Queue management** - Prevents duplicate concurrent searches
✅ **Fuzzy matching** - Catches similar topics (80% threshold)
✅ **Auto-cleanup** - Old entries expire automatically
✅ **Visual status** - See what's cached and queued in logs

## Quick Commands

### Check What's Cached
```bash
curl http://localhost:9995/api/discovery/status
```

### Clear Cache (Testing)
```bash
curl -X POST http://localhost:9995/api/discovery/clear-cache
```

## Configuration (in main.js)

```javascript
const discoveryManager = new DiscoveryManager({
  cacheWindowMs: 30 * 60 * 1000,    // 30 minutes
  similarityThreshold: 0.8,          // 80% match
  enableLogging: true                // Show logs
});
```

## Common Tuning

### Make Cache Last Longer
```javascript
cacheWindowMs: 60 * 60 * 1000  // 1 hour
```

### Make Matching More Strict
```javascript
similarityThreshold: 0.9  // 90% match required
```

### Make Matching More Loose
```javascript
similarityThreshold: 0.7  // 70% match required
```

## What You'll See in Logs

### Cache Hit (Skipped)
```
📋 Cache hit: "salesforce stock" matches "Salesforce stock price" (95% similar)
⏭️ Skipped 1 insights (already cached/queued):
   - "salesforce stock" (already_cached)
```

### New Discovery
```
📥 Added to queue [q_1]: "Weather in NYC"
🔍 Discovering: Weather in NYC using weather
💾 Cached discovery: "Weather in NYC"
📤 Removed from queue [q_1]: "Weather in NYC"
```

### Status Summary
```
📊 Discovery Status:

💾 Cached (2):
   1. Salesforce stock price (3m ago)
   2. Weather in SF (10m ago)

⏳ Queued (1):
   1. HuggingFace models (5s ago)
```

## When to Clear Cache

- Testing changes
- After deploying
- If seeing stale data
- If cache seems broken

## Key Files

- **Implementation**: `utils/discovery-cache-utils.js`
- **Integration**: `main.js` (lines 225-230, 990-1170)
- **Documentation**: `DISCOVERY_CACHE_GUIDE.md`

## Testing Flow

1. **First message**: "What's Salesforce's stock price?"
   - Should discover ✅
   - Should cache result ✅

2. **Second message**: "Tell me about Salesforce stock"
   - Should skip (cache hit) ✅
   - Should show in logs ✅

3. **Check status**: `curl /api/discovery/status`
   - Should show cached item ✅

## Troubleshooting

**Problem**: Not seeing cache hits
- Check logs for cache status
- Try lowering similarity threshold to 0.7

**Problem**: Too many cache hits
- Increase similarity threshold to 0.9
- Reduce cache window to 15 minutes

**Problem**: Queue growing
- Check for errors in logs
- Check if discoveries are completing

## Success Metrics

**Good Discovery Mode:**
- Cache hit rate: 20-40%
- Queue mostly empty (0-1 items)
- No repeat discoveries within 30 minutes
- Clear log output showing decisions

## Remember

The goal is to make Discovery Mode **very selective** about what it looks up, avoiding redundant searches while still being helpful!

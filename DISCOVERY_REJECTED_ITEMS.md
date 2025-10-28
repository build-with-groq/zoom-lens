# Discovery Feed - Showing Rejected/Skipped Items

## Overview

Discovery Mode now shows **what it chooses NOT to research** in the Discovery Feed, providing full transparency into its decision-making process.

## Why This Matters

**Before**: You only saw what Discovery researched. If it skipped something, you had no idea why.

**After**: You see both:
- ✅ **Discovered items** - What it researched
- ⏭️ **Skipped items** - What it considered but skipped, with reasoning

## Types of Skipped Items

### 1. **Decision Skip** - No research needed

When Discovery decides the conversation doesn't need external research:

```
⏭️ Discovery Skipped

The latest user message does not introduce any new person, company,
product, or distinct topic that hasn't already been discovered.
```

**Example scenarios**:
- "ok thanks"
- "lol yeah"
- "no idea"
- Casual conversation without specific entities

---

### 2. **Cached Skip** - Already researched recently

When Discovery finds the topic in its 30-minute cache:

```
⏭️ Formula 1 team standings

Already researched recently

This topic was discovered within the last 30 minutes.
```

**Example scenario**:
- User: "Who's leading F1?" → Discovery researches ✅
- User: "What about the F1 standings?" (5 min later) → Skipped (cached) ⏭️

---

### 3. **Queue Skip** - Currently being researched

When Discovery finds the topic is already being processed:

```
⏭️ Salesforce stock price

Already being researched

This topic is currently being processed.
```

**Example scenario**:
- User sends: "What's Salesforce's stock price?"
- Before Discovery finishes, user sends: "Tell me about Salesforce stock"
- Second request skipped (already in queue) ⏭️

---

## Response Format

### Discovery Response Object

```json
{
  "success": true,
  "insights": [
    {
      "type": "discovered",
      "content": "### 🔮 Topic\n\n**One-liner**\n\nContext paragraph",
      "skipped": false,
      "topic": "Topic name",
      "timestamp": 1234567890,
      "tools": [...],
      "routing": {...},
      "citations": [...]
    },
    {
      "type": "skipped_topic",
      "content": "### ⏭️ Topic\n\n**Already researched recently**\n\nThis topic was discovered within the last 30 minutes.",
      "skipped": true,
      "topic": "Topic name",
      "reason": "already_cached",
      "timestamp": 1234567890
    },
    {
      "type": "decision",
      "content": "### ⏭️ Discovery Skipped\n\n**Reasoning**",
      "skipped": true,
      "reasoning": "No new entities mentioned",
      "timestamp": 1234567890
    }
  ],
  "discovered_count": 1,
  "skipped_count": 2,
  "cache_summary": {...}
}
```

### Insight Types

| Type | Description | Icon | skipped |
|------|-------------|------|---------|
| `discovered` | Successfully researched | 🔮 | false |
| `skipped_topic` | Cached or queued topic | ⏭️ | true |
| `decision` | Decision not to research | ⏭️ | true |

---

## Frontend Integration

The frontend can now distinguish and style items differently:

```javascript
// Example React/JS code
insights.forEach(insight => {
  if (insight.skipped) {
    // Style as skipped (gray, faded, different icon)
    renderSkippedInsight(insight);
  } else {
    // Style as discovered (normal)
    renderDiscoveredInsight(insight);
  }
});
```

### Styling Suggestions

**Discovered items** (skipped: false):
- ✅ Normal opacity
- ✅ Full color
- ✅ Icon: 🔮
- ✅ Expandable for more details

**Skipped items** (skipped: true):
- ⏭️ Reduced opacity (50-70%)
- ⏭️ Gray/muted colors
- ⏭️ Icon: ⏭️
- ⏭️ Collapsible/hidden by default
- ⏭️ Optional "Show skipped items" toggle

---

## Examples

### Example 1: Mixed Results

**Conversation**:
- User: "Who won the F1 race?"
- User: "What about the race winner?" (2 min later)

**Discovery Feed shows**:
```
✅ 🔮 Formula 1 race winner
   Lando Norris won the Mexico City Grand Prix...

⏭️ Formula 1 race winner
   Already researched recently
   This topic was discovered within the last 30 minutes.
```

---

### Example 2: Decision Skip

**Conversation**:
- User: "lol yeah"
- User: "no idea"

**Discovery Feed shows**:
```
⏭️ Discovery Skipped

The latest user message does not introduce any new person, company,
product, or distinct topic that hasn't already been discovered.
```

---

### Example 3: All Discovered

**Conversation**:
- User: "Who won F1?"
- User: "Which teams are leading?" (different topic)

**Discovery Feed shows**:
```
✅ 🔮 Formula 1 race winner
   Lando Norris won the Mexico City Grand Prix...

✅ 🔮 F1 constructor standings
   McLaren leads with 713 points...
```

(No skipped items - all unique topics)

---

## Console Output

You'll now see skipped items in logs:

```
🔮 Discovery Mode: Analyzing 5 transcripts...

📋 Discovery decision:
   should_discover: false
   insights_count: 0
   skipped_count: 1
   reasoning: "No new entities mentioned"

⏭️ Skipped 1 insights (already cached/queued):
   - "Formula 1 standings" (already_cached)

ℹ️ No discovery insights needed

Response includes:
   discovered_count: 0
   skipped_count: 1
```

---

## API Changes

### Before
```json
{
  "insights": [
    // Only discovered items
  ]
}
```

### After
```json
{
  "insights": [
    // Both discovered AND skipped items
  ],
  "discovered_count": 1,
  "skipped_count": 2
}
```

**Breaking change**: None! The `insights` array is still the same structure, just includes additional items with `skipped: true` flag.

---

## Benefits

### 1. **Transparency**
See why Discovery didn't research something:
- "Already cached" - Got it recently
- "No entities mentioned" - Nothing to research
- "Being researched" - In progress

### 2. **Understanding Behavior**
Learn how Discovery thinks:
- What triggers it
- What it considers relevant
- When it uses cache

### 3. **Debugging**
Quickly see if:
- Cache is working correctly
- Topics are being identified
- Decision logic is sound

### 4. **User Trust**
Users can see the assistant is:
- Not ignoring their messages
- Making intelligent decisions
- Being efficient (using cache)

---

## Configuration

### Show/Hide Skipped Items

The frontend can:

**Option 1**: Always show skipped items (transparent)
```javascript
// Render all insights including skipped
insights.forEach(renderInsight);
```

**Option 2**: Hide by default with toggle
```javascript
<button onClick={toggleSkipped}>
  {showSkipped ? 'Hide' : 'Show'} skipped items ({skipped_count})
</button>

{insights.filter(i => showSkipped || !i.skipped).map(renderInsight)}
```

**Option 3**: Show count only
```javascript
<div>
  {discovered_count} discovered, {skipped_count} skipped
</div>
```

---

## Testing

### Test 1: Cache Hit

```javascript
// First request
POST /api/discovery-analysis
{ transcripts: [{ data: "Who won F1?" }] }

// Response includes discovered item
{ insights: [{ type: "discovered", topic: "F1 race winner", skipped: false }] }

// Second request (within 30 min)
POST /api/discovery-analysis
{ transcripts: [{ data: "Tell me about the F1 winner" }] }

// Response includes skipped item
{ insights: [{ type: "skipped_topic", topic: "F1 race winner", skipped: true, reason: "already_cached" }] }
```

### Test 2: Decision Skip

```javascript
POST /api/discovery-analysis
{ transcripts: [{ data: "ok thanks" }] }

// Response includes decision skip
{ insights: [{ type: "decision", skipped: true, reasoning: "No entities mentioned" }] }
```

### Test 3: Mixed

```javascript
POST /api/discovery-analysis
{
  transcripts: [
    { data: "Who won F1?" },
    { data: "And the F1 winner again?" }
  ]
}

// Response includes both
{
  insights: [
    { type: "discovered", skipped: false, ... },
    { type: "skipped_topic", skipped: true, ... }
  ],
  discovered_count: 1,
  skipped_count: 1
}
```

---

## Visual Examples

### UI Layout Suggestion

```
Discovery Feed
─────────────────────────────────────────
[Toggle: Show 2 skipped items]

✅ 🔮 Formula 1 race winner
   Lando Norris won the Mexico City Grand Prix...

⏭️ Formula 1 race winner (faded, gray)
   Already researched recently
   [Collapsed by default]

⏭️ Discovery Skipped (faded, gray)
   No new entities mentioned
   [Collapsed by default]
```

### Alternative: Inline Count

```
Discovery Feed (1 discovered, 2 skipped)
─────────────────────────────────────────

✅ 🔮 Formula 1 race winner
   Lando Norris won the Mexico City Grand Prix...
```

---

## Summary

Discovery Mode now provides **full transparency** by showing:
- ✅ What it discovered (green, 🔮)
- ⏭️ What it skipped (gray, ⏭️)
- 📊 Why it made each decision

This helps users:
- Understand Discovery's behavior
- Trust the system
- Debug issues
- See cache efficiency

**Result**: A more transparent and trustworthy Discovery Mode! 🎉

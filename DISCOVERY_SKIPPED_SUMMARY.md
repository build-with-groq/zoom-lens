# Discovery Skipped Items - Quick Summary

## What Changed

Discovery Feed now shows **what it chose NOT to research**, providing full transparency!

---

## New Response Format

### Insight Object Fields

Every insight now includes:

```javascript
{
  type: "discovered" | "skipped_topic" | "decision",
  content: "...",
  skipped: true | false,
  timestamp: 1234567890,
  // ... other fields
}
```

### Response Structure

```json
{
  "insights": [
    // Discovered items (skipped: false)
    { "type": "discovered", "skipped": false, "topic": "F1 winner", ... },

    // Skipped items (skipped: true)
    { "type": "skipped_topic", "skipped": true, "reason": "already_cached", ... },
    { "type": "decision", "skipped": true, "reasoning": "No entities", ... }
  ],
  "discovered_count": 1,
  "skipped_count": 2
}
```

---

## 3 Types of Skipped Items

### 1. Decision Skip
```
⏭️ Discovery Skipped

No new entities mentioned in the conversation.
```

### 2. Cached Skip
```
⏭️ Formula 1 race winner

Already researched recently

This topic was discovered within the last 30 minutes.
```

### 3. Queue Skip
```
⏭️ Salesforce stock price

Already being researched

This topic is currently being processed.
```

---

## Frontend Styling

```javascript
// Distinguish by skipped flag
if (insight.skipped) {
  // Style: gray, faded, collapsed
  className = "discovery-item-skipped";
  icon = "⏭️";
} else {
  // Style: normal, colorful, expanded
  className = "discovery-item-discovered";
  icon = "🔮";
}
```

### CSS Example

```css
.discovery-item-discovered {
  opacity: 1;
  color: var(--text-primary);
  border-left: 3px solid var(--accent-color);
}

.discovery-item-skipped {
  opacity: 0.6;
  color: var(--text-muted);
  border-left: 3px solid var(--gray);
}
```

---

## UI Options

### Option 1: Always Show
```
✅ 🔮 Formula 1 race winner
   Lando Norris won...

⏭️ Formula 1 standings
   Already researched recently
```

### Option 2: Toggle
```
[Show 2 skipped items ▼]

✅ 🔮 Formula 1 race winner
   Lando Norris won...
```

### Option 3: Count Only
```
Discovery (1 discovered, 2 skipped)

✅ 🔮 Formula 1 race winner
   Lando Norris won...
```

---

## Examples

### Example 1: Cache Hit

User: "Who won F1?"
→ ✅ Discovered: "F1 race winner"

User: "Tell me about the F1 winner" (5 min later)
→ ⏭️ Skipped: "Already researched recently"

---

### Example 2: No Entities

User: "lol yeah"
→ ⏭️ Skipped: "No new entities mentioned"

---

### Example 3: All Discovered

User: "Who won F1?"
→ ✅ Discovered: "F1 race winner"

User: "Which teams are leading?"
→ ✅ Discovered: "F1 constructor standings"

(Different topics, both researched)

---

## API Response

```bash
# Test it
curl -X POST http://localhost:9995/api/discovery-analysis \
  -H "Content-Type: application/json" \
  -d '{"transcripts": [{"data": "ok thanks"}]}'

# Response
{
  "insights": [
    {
      "type": "decision",
      "content": "### ⏭️ Discovery Skipped\n\n**No entities mentioned**",
      "skipped": true,
      "reasoning": "No new entities mentioned"
    }
  ],
  "discovered_count": 0,
  "skipped_count": 1
}
```

---

## Files Changed

### main.js (lines 1243-1279)
Added skipped insights to "no discovery needed" response

### main.js (lines 1416-1440)
Added skipped insights to successful response

### main.js (lines 1379-1390)
Added `skipped: false` to discovered insights

---

## Benefits

1. **Transparency** - See all decisions
2. **Understanding** - Learn how it thinks
3. **Debugging** - Spot cache issues
4. **Trust** - Know it's working

---

## Quick Integration

### JavaScript
```javascript
const { insights, discovered_count, skipped_count } = response;

// Show counts
console.log(`Discovered: ${discovered_count}, Skipped: ${skipped_count}`);

// Render all
insights.forEach(insight => {
  const style = insight.skipped ? 'skipped' : 'discovered';
  renderInsight(insight, style);
});
```

### React
```jsx
<div>
  <h3>Discovery ({discovered_count} new)</h3>
  {insights.map(insight => (
    <InsightCard
      key={insight.timestamp}
      {...insight}
      className={insight.skipped ? 'muted' : 'active'}
    />
  ))}
</div>
```

---

## Summary

Discovery Mode now shows:
- ✅ **Discovered** (skipped: false) - What it researched
- ⏭️ **Skipped** (skipped: true) - What it chose not to research

The frontend can style them differently and optionally hide/show skipped items!

**Full transparency = better UX! 🎉**

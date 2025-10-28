# Discovery Mode Format Update

## What Changed

Discovery Mode now provides **two levels of information** instead of just a one-liner:

### Before (Too Brief!)
```
🔮 Lando Norris

Lando Norris
```
😂 Way too compressed!

### After (Better!)
```
🔮 Lando Norris

**Lando Norris drives for McLaren Racing and currently leads the 2025 Formula 1 Drivers' Championship.**

Norris joined McLaren in 2019 and has established himself as one of F1's rising stars. His team McLaren is currently leading the constructors' championship with 713 points, giving them a strong position in the team standings heading into the final races of the season.
```
✅ One-liner (bold) + context paragraph!

---

## New Format Structure

Each discovery insight now includes:

1. **One-liner (bold)**: 25 words max
   - Includes key facts, names, numbers, dates
   - Informative and complete
   - Answers the core question

2. **Context paragraph**: 2-3 sentences, 75 words max
   - Relevant details and numbers
   - Additional context
   - Deeper information

---

## Changes Made

### File: `main.js` (lines 1289-1355)

**Before**:
- First extraction: Max 20 words
- Second distillation: Max 15 words (way too aggressive!)
- Output: Single compressed line

**After**:
- **Step 1**: One-liner extraction (max 25 words)
  - More room for complete information
  - Includes key facts

- **Step 2**: Context paragraph (max 75 words, 2-3 sentences)
  - Provides depth and details
  - Gives full picture

- **Output format**:
  ```markdown
  ### 🔮 {Topic}

  **{One-liner}**

  {Context paragraph}
  ```

---

## Examples

### Example 1: Formula 1 Results

**One-liner**:
**Lando Norris won the Mexico City Grand Prix on October 26, 2025.**

**Context**:
The race was held at the Autódromo Hermanos Rodríguez circuit in Mexico City. Norris's victory helped McLaren extend their lead in the constructors' championship. This was one of his strongest performances of the 2025 season.

---

### Example 2: Company Information

**One-liner**:
**Agora.io is a publicly traded real-time engagement platform founded in 2014, ticker symbol API on NASDAQ.**

**Context**:
Agora provides APIs for voice, video, and live interactive streaming that power applications across gaming, social media, education, and healthcare. The company went public in 2020 and currently trades around $3.63 per share as of October 2025.

---

### Example 3: Stock Price

**One-liner**:
**Agora Inc. (ticker API) trades on the NASDAQ at roughly $3.63 per share as of October 28, 2025.**

**Context**:
The stock has experienced significant volatility since its IPO in 2020 when it debuted at $50 per share. Despite strong revenue growth in the real-time engagement space, the stock has declined due to increased competition and market conditions affecting tech valuations.

---

## Console Output

You'll now see two extraction steps in the logs:

```
📝 Processing findings for background research...
📝 Extracting context paragraph...
💾 Cached discovery: "Lando Norris"
```

---

## Configuration

The distillation happens in the discovery endpoint:

**One-liner extraction**:
- Model: `MODEL_EXTRACTOR` (llama-3.3-70b-versatile)
- Max tokens: 200
- Max words: 25
- Temperature: 0.1

**Context paragraph**:
- Model: `MODEL_EXTRACTOR` (llama-3.3-70b-versatile)
- Max tokens: 300
- Max words: 75 (2-3 sentences)
- Temperature: 0.1

---

## Benefits

### Before (Too Compressed)
- ❌ "Lando Norris" - What about him?!
- ❌ Lost all context in compression
- ❌ Not useful

### After (Balanced)
- ✅ Quick one-liner for scanning
- ✅ Context paragraph for depth
- ✅ Actually informative!
- ✅ Includes numbers, dates, details

---

## Why Two Extractions?

1. **One-liner**: Quick glanceable summary
   - For quick scanning in the feed
   - Answers "what is this about?"
   - Includes key facts

2. **Context paragraph**: Deeper information
   - For when you want to know more
   - Provides full picture
   - Includes relevant details

---

## Response Object

The processed insight now includes:

```javascript
{
  content: "### 🔮 {topic}\n\n**{oneLiner}**\n\n{context}",
  tools: [...],
  routing: {...},
  citations: [...],
  oneLiner: "...",      // NEW: Separate one-liner
  context: "..."        // NEW: Separate context
}
```

This allows the frontend to:
- Show just one-liner initially
- Expand to show context
- Style them differently
- etc.

---

## Testing

Try these queries to see the new format:

1. **Person**: "Tell me about Lando Norris"
   - Should get: Name + team + championship position
   - Plus: Career details, team performance

2. **Company**: "What is Agora.io?"
   - Should get: Company description + ticker
   - Plus: IPO date, services, current status

3. **Event**: "Who won the latest F1 race?"
   - Should get: Winner + date + location
   - Plus: Race details, championship implications

---

## Tuning

If you want **more/less** information:

### Longer one-liner (main.js line 1296)
```javascript
- Maximum 25 words  // Change to 30 or 35
```

### Longer context (main.js line 1324)
```javascript
- Maximum 75 words  // Change to 100 or 50
- 2-3 sentences total  // Change to 3-4 or just 2
```

### More tokens (if responses get cut off)
```javascript
max_tokens: 300  // Increase to 400 or 500
```

---

## Summary

Discovery Mode is now **much more informative**!

Instead of over-compressed one-liners like "Lando Norris" 😂, you get:
- ✅ Clear, informative summary (25 words)
- ✅ Additional context and details (75 words, 2-3 sentences)

Perfect for background research! 🎯

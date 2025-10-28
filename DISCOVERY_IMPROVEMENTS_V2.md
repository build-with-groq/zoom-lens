# Discovery Mode Improvements v2

## Issues Fixed

### 1. ✅ Truncated Output
**Before**: "Lando Norris won" (too brief!)
**After**: One-liner + context paragraph

### 2. ✅ Limited Context
**Before**: Only saw 10 messages
**After**: Sees 30 messages for better context

### 3. ✅ Too Reluctant
**Before**: Grouped "race winner" and "team standings" as same topic
**After**: Recognizes different aspects are different topics

---

## Changes Made

### 1. Better Logging (main.js line 1203-1206)

**Before**:
```javascript
console.log(`Transcripts received:`, transcripts.map(t => `"${t.data?.substring(0, 50)}..."`));
```

**After**:
```javascript
// Show first 3 transcripts with FULL content
console.log(`Latest transcripts (full):`, transcripts.slice(0, 3).map((t, i) =>
  `[${i}] ${t.user_name || 'User'}: "${t.data}"`
).join('\n   '));
```

**Why**: See full transcript content in logs, not truncated

---

### 2. More Context for Discovery (main.js line 1216)

**Before**:
```javascript
const chatHistory = transcripts.slice(0, 20).reverse().map(...)
```

**After**:
```javascript
// Use MORE messages (50 instead of 20) for better context
const chatHistory = transcripts.slice(0, 50).reverse().map(...)
```

**Why**: Discovery needs to see more conversation to understand context

---

### 3. More Context in Evaluation (discovery-cache-utils.js line 369)

**Before**:
```javascript
const recentHistory = chatHistory.slice(-10); // Last 10 messages
```

**After**:
```javascript
// Use more messages (30 instead of 10) for better conversation context
const recentHistory = chatHistory.slice(-30); // Last 30 messages
console.log(`📝 Using ${recentHistory.length} messages for discovery context`);
```

**Why**: 10 messages wasn't enough to understand full context

---

### 4. More Proactive Prompting (discovery-cache-utils.js lines 408-420)

**Before**:
```
**DO NOT Research**:
- Topics already cached or queued
- ...

**Rules**:
1. Default to "should_discover": false
2. ...
```

**After**:
```
**DO NOT Research**:
- Exact same topics already cached or queued  // Changed!
- ...

**Rules**:
1. Be PROACTIVE - if there's a specific entity, topic, or question, research it!  // NEW!
2. Different aspects of a topic are DIFFERENT (e.g., "race winner" vs "team standings")  // NEW!
3. Prioritize Salesforce for ANY person/company names
4. Use web search (groq_compound) for everything else
5. DO NOT repeat the EXACT same cached topic  // Changed from "any cached"
6. Maximum 1 insight per request
7. When in doubt, research it - background info is valuable!  // NEW!
```

**Why**:
- Was too conservative
- Grouped different aspects as same topic
- Needed to be more helpful

---

### 5. More Proactive System Prompt (discovery-cache-utils.js lines 444-445)

**Before**:
```
You are a background research AI for Discovery Mode. Your job is to quietly pull relevant background information about people, companies, and topics mentioned in conversation. Prioritize Salesforce for person/company names, use web search for everything else. Default to NOT researching unless there's a clear person/company/topic worth looking up. Always check cached and queued topics first.
```

**After**:
```
You are a PROACTIVE background research AI for Discovery Mode. Your job is to pull relevant background information about people, companies, topics, and questions mentioned in conversation. Be helpful and proactive - if someone asks a question or mentions an entity, research it! Prioritize Salesforce for person/company names, use web search for everything else. Don't repeat EXACT same topics that are cached. Different aspects of a topic are different (e.g., "race winner" vs "team standings"). When in doubt, research it - background info is valuable!
```

**Key Changes**:
- Added "PROACTIVE" emphasis
- "Be helpful and proactive - if someone asks a question or mentions an entity, research it!"
- "Different aspects of a topic are different"
- "When in doubt, research it"
- Removed "Default to NOT researching"

---

## Context Flow

```
Frontend sends transcripts
    ↓
main.js receives transcripts (FULL data)
    ↓
Takes first 50 transcripts (was 20)
    ↓
evaluateDiscoveryNeed() receives 50
    ↓
Uses last 30 messages for context (was 10)
    ↓
AI evaluates with full context
    ↓
More proactive decision making
```

---

## Examples of Improved Behavior

### Example 1: Different Aspects

**Conversation**:
- User: "Who won the F1 race?"
  → Discovery: "Formula 1 2025 race results" ✅

- User: "Which teams are doing best?"
  → **Before**: Skipped (thought it was same as "race results")
  → **After**: Discovers "F1 constructor standings" ✅ (different aspect!)

### Example 2: More Context

**Conversation**:
- Users discuss various topics for 25 messages
- User: "Tell me about that company we mentioned"
  → **Before**: Only saw last 10 messages, might miss the reference
  → **After**: Sees last 30 messages, finds the company name ✅

### Example 3: Proactive

**Conversation**:
- User: "I wonder what React's latest version is?"
  → **Before**: Might skip (not a direct command)
  → **After**: Researches it! ✅ (proactive)

---

## Important Notes

### ⚠️ Server Restart Required!

If you're seeing old truncated responses like "Lando Norris won", **restart the server** to apply these changes!

The old format is cached. After restart, you should see:

```
🔮 Formula 1 2025 race results

**Lando Norris won the Mexico City Grand Prix on October 26, 2025.**

The race was held at the Autódromo Hermanos Rodríguez circuit in Mexico City. Norris's victory helped McLaren extend their lead in the constructors' championship. This was one of his strongest performances of the 2025 season.
```

### Clear Cache

You may want to clear the discovery cache to test:

```bash
curl -X POST http://localhost:9995/api/discovery/clear-cache
```

---

## Testing

### Test 1: Different Aspects
1. Ask: "Who won the F1 race?"
2. Ask: "Which teams are leading?"
3. **Expected**: Both trigger (different aspects)

### Test 2: Full Context
1. Have a long conversation (20+ messages)
2. Reference something from earlier
3. **Expected**: Discovery understands the reference

### Test 3: Proactive
1. Mention a company casually
2. **Expected**: Discovery looks it up

---

## Summary

**Before**:
- ❌ Only 10-20 messages context
- ❌ Too conservative (grouped different aspects)
- ❌ Truncated logging
- ❌ "Default to not researching"

**After**:
- ✅ 30-50 messages context
- ✅ Proactive (different aspects are different)
- ✅ Full transcript logging
- ✅ "When in doubt, research it!"

**Result**: Discovery Mode is now much more helpful and context-aware! 🎉

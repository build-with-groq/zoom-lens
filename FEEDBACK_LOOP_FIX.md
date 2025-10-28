# Feedback Loop Fix

## Problem

Router decision messages were creating an infinite feedback loop:

```
1. User message → Router decides to skip
2. Router decision broadcast to action feed
3. Router decision added to transcripts
4. Router decision processed as new message
5. New router decision about the router decision
6. Loop continues infinitely! 🔄💥
```

## Logs Showed

```
06:04 PM Router Decision
💭 Skipping: The message is a casual test statement...

06:04 PM Zoom AI Assistant
"💭 Skipping: The message is a casual test statement..."

06:04 PM Router Decision
💭 Skipping: The user is providing a meta comment about skipping...

06:04 PM Zoom AI Assistant
"💭 Skipping: The user is providing a meta comment about skipping..."

[... continues forever]
```

## Root Cause

Router decision broadcasts used:
- `user_id: 'zoom-ai-router'`
- `user_name: 'Router Decision'`

But the AI message filter only checked for:
```javascript
user_id === 'zoom-ai' ||
user_id === 'discovery-ai' ||
user_id === 'system'
```

**Missing**: `zoom-ai-router` and `Router Decision`!

## Fix

Added router IDs to the AI message filter:

**File**: `main.js` (lines 816-822)

```javascript
// CRITICAL SAFETY CHECK: Reject AI-generated messages immediately
const isAIMessage = user_id === 'zoom-ai' ||
                   user_id === 'discovery-ai' ||
                   user_id === 'zoom-ai-router' ||  // ✅ ADDED
                   user_id === 'system' ||
                   user_name === 'Zoom AI Assistant' ||
                   user_name === 'Router Decision' ||  // ✅ ADDED
                   user_name === 'Discovery';
```

## Result

Router decision messages are now **blocked from re-processing**:

```
1. User message → Router decides to skip
2. Router decision broadcast to action feed ✅
3. Router decision displayed in UI ✅
4. Router decision blocked from re-processing ✅
5. No feedback loop! ✅
```

## Testing

### Before Fix (Feedback Loop)
```
User: "lol"
→ Router: Skip
→ Router processes its own message
→ Router: Skip the skip message
→ Router processes the skip message about skipping
→ [infinite loop]
```

### After Fix (No Loop)
```
User: "lol"
→ Router: Skip ✅
→ Decision broadcast to action feed ✅
→ Decision blocked from re-processing ✅
→ [stops here]
```

## All Protected User IDs

The system now filters out:

| user_id | user_name | Purpose |
|---------|-----------|---------|
| `zoom-ai` | `Zoom AI Assistant` | Main assistant responses |
| `discovery-ai` | `Discovery` | Discovery Mode insights |
| `zoom-ai-router` | `Router Decision` | Router decisions |
| `system` | (any) | System messages |

## Prevention

To add a new AI message type:

1. Choose a unique `user_id` (e.g., `zoom-ai-newfeature`)
2. Add to the `isAIMessage` check:
```javascript
const isAIMessage = user_id === 'zoom-ai' ||
                   user_id === 'discovery-ai' ||
                   user_id === 'zoom-ai-router' ||
                   user_id === 'zoom-ai-newfeature' ||  // NEW
                   user_id === 'system' ||
                   ...
```
3. Test that it doesn't create a feedback loop

## Related Code

**Action feed broadcast** (`heyzoom-decision-utils.js`):
```javascript
export function createActionFeedBroadcast(decision, transcript) {
  return {
    user_id: 'zoom-ai-router',        // ← Must be filtered!
    user_name: 'Router Decision',     // ← Must be filtered!
    data: `${icon} ${action}: ${decision.reasoning}`,
    type: 'router_decision',
    ...
  };
}
```

**AI message filter** (`main.js` line 816):
```javascript
const isAIMessage = user_id === 'zoom-ai' ||
                   user_id === 'discovery-ai' ||
                   user_id === 'zoom-ai-router' ||  // ← Matches above!
                   ...
```

## Summary

**Problem**: Router decisions created feedback loop
**Cause**: Router decision user_id not filtered
**Fix**: Added `zoom-ai-router` and `Router Decision` to filter
**Result**: No more infinite loops! ✅

Always add new AI message types to the filter! 🛡️

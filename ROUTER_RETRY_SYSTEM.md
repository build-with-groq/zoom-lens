# Router Retry System - Race-Based Implementation

## Overview
This document describes the race-based retry system implemented for the intelligent router to handle slow or hanging model responses.

## Problem
The router uses `openai/gpt-oss-20b` (configured via `MODEL_ROUTER` in `config.js`) which sometimes hangs or takes too long to respond, causing the "Fetching response..." message to display indefinitely.

## Solution
Implemented a **race-based retry system** that:
1. Fires the initial router request immediately
2. After a configurable delay (default 3.5 seconds), fires a second identical request
3. Uses whichever request completes first
4. Automatically cancels/ignores the slower request

## How It Works

### Flow Diagram
```
User Message → Router Request #1 (immediate)
                     ↓
              Wait 3.5 seconds
                     ↓
        Request #1 still pending?
                     ↓
           Yes → Fire Request #2
                     ↓
         Race: First to complete wins!
                     ↓
              Use fastest response
```

### Implementation Details

**Location:** `ai-inference.js` - `intelligentRouter()` function (lines 365-440)

**Key Components:**

1. **Request Factory Function:**
   ```javascript
   const createRouterRequest = () => {
     return groqClient.chat.completions.create({
       model: MODEL_ROUTER,
       messages: [...],
       temperature: 0.1,
       max_tokens: 1000,
       response_format: { type: "json_object" }
     });
   };
   ```

2. **First Request:** Fires immediately
   ```javascript
   const firstRequest = createRouterRequest();
   ```

3. **Retry Request:** Fires after delay if first hasn't completed
   ```javascript
   const retryPromise = new Promise((resolve, reject) => {
     setTimeout(async () => {
       if (!firstRequestFinished) {
         console.log('🔄 ROUTING: First request taking too long, firing retry...');
         const retryResponse = await createRouterRequest();
         resolve(retryResponse);
       }
     }, RETRY_DELAY_MS);
   });
   ```

4. **Race Logic:** Use whichever completes first
   ```javascript
   response = await Promise.race([
     firstRequest.then(r => {
       firstRequestFinished = true;
       return r;
     }),
     retryPromise
   ]);
   ```

5. **Fallback Safety:** If race fails, fall back to first request
   ```javascript
   if (!response) {
     response = await firstRequest;
   }
   ```

## Configuration

### Environment Variable
You can configure the retry delay in your `.env` file:

```env
# Router retry delay in milliseconds (default: 3500)
ROUTER_RETRY_DELAY_MS=3500
```

**Recommended values:**
- Fast retries: `2000` (2 seconds) - More aggressive, uses more API calls
- Balanced: `3500` (3.5 seconds) - Default, good balance
- Conservative: `5000` (5 seconds) - Fewer retries, longer wait

### Code Configuration
The constant is exported from `config.js`:
```javascript
export const ROUTER_RETRY_DELAY_MS = parseInt(
  Deno.env.get("ROUTER_RETRY_DELAY_MS") || "3500"
);
```

## Benefits

1. **Improved User Experience:**
   - No more indefinite "Fetching response..." hang
   - Faster responses when first request is slow
   - Automatic recovery from slow API responses

2. **Reliability:**
   - Graceful handling of slow/hanging requests
   - Fallback to first request if retry also fails
   - No breaking changes to existing code

3. **Cost Efficiency:**
   - Only fires retry if first request is actually slow
   - Uses same model for both requests (consistent quality)
   - Ignores slower request automatically

4. **Configurable:**
   - Adjust retry delay via environment variable
   - No code changes needed to tune behavior
   - Can be disabled by setting very high delay value

## Console Logging

The system provides clear logging to track behavior:

```
🏁 ROUTING: Starting race-based router request (retry after 3500ms)...
🔄 ROUTING: First request taking too long, firing retry request...
✅ ROUTING: Retry request completed first!
```

Or if first request wins:
```
🏁 ROUTING: Starting race-based router request (retry after 3500ms)...
✅ ROUTING: First request completed!
```

## Testing

### Test Scenarios

1. **Fast First Request (< 3.5s):**
   - First request completes before retry fires
   - No retry request is made
   - Expected logs: "First request completed!"

2. **Slow First Request (> 3.5s):**
   - Retry request fires at 3.5s mark
   - Whichever completes first is used
   - Expected logs: "First request taking too long..." → "Retry request completed first!"

3. **Both Fail:**
   - Both requests encounter errors
   - System attempts fallback to first request
   - Error is logged and thrown

### Manual Testing

To test the retry system:

1. Send a "Hey Zoom" request in the app
2. Watch the console logs in your terminal
3. Look for race logging messages
4. Verify response appears within reasonable time

### Tuning the Delay

If you find requests often complete within 2 seconds:
```env
ROUTER_RETRY_DELAY_MS=2000
```

If you want to reduce API costs and requests rarely hang:
```env
ROUTER_RETRY_DELAY_MS=5000
```

## Files Changed

1. **`config.js`** (Line 45):
   - Added `ROUTER_RETRY_DELAY_MS` configuration constant
   - Default value: 3500ms (3.5 seconds)

2. **`ai-inference.js`** (Lines 6-14, 365-440):
   - Imported `ROUTER_RETRY_DELAY_MS` from config
   - Implemented race-based retry system in `intelligentRouter()`
   - Added comprehensive error handling and fallback logic

## Future Improvements

Potential enhancements for consideration:

1. **Adaptive Retry:**
   - Track average response times
   - Adjust retry delay dynamically based on history
   - Use shorter delays during high-load periods

2. **Multiple Retries:**
   - Fire 2-3 requests in sequence
   - Use first successful response
   - More aggressive but higher cost

3. **Metrics & Monitoring:**
   - Track how often retry wins vs first request
   - Log average response times
   - Alert if retry usage exceeds threshold

4. **Model Fallback:**
   - If oss-20b is slow, retry with faster model (e.g., llama-3.1-8b-instant)
   - Trade quality for speed when needed
   - Could reduce costs for slow requests

## Notes

- The retry fires a completely new request (not a duplicate)
- Both requests count towards your API quota if both complete
- The slower request is abandoned (not cancelled) - Groq will still process it
- No performance impact on fast requests (< 3.5s)
- Works seamlessly with existing error handling and routing logic

## Related Configuration

The router uses these models from `config.js`:
```javascript
export const MODEL_ROUTER = Deno.env.get("MODEL_ROUTER") || "openai/gpt-oss-20b";
```

To use a faster model for all routing (no retry needed):
```env
MODEL_ROUTER=llama-3.1-8b-instant
```

However, oss-20b generally provides better routing quality, so the retry system is a good compromise between speed and quality.


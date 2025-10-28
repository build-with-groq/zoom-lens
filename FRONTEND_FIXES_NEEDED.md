# Frontend Fixes Needed

## Issue 1: Sending AI Messages to Backend

**Problem**: Router decisions, assistant responses, and other AI-generated messages are being sent to `/api/trigger-groq`, triggering the backend's AI message blocking.

**Current behavior**:
```
User: "hey sup"
→ Router Decision: "💭 Skipping: ..."
→ Frontend sends Router Decision to backend
→ Backend blocks it (correct)
→ UI shows "Fetching response..." (incorrect)
```

**Solution**: Filter AI messages in the frontend BEFORE sending to backend.

### Frontend Code Needed

```javascript
// Don't send AI-generated messages to backend
function shouldSendToBackend(message) {
  const aiUserIds = [
    'zoom-ai',
    'zoom-ai-router',
    'discovery-ai',
    'system'
  ];

  const aiUserNames = [
    'Zoom AI Assistant',
    'Router Decision',
    'Discovery'
  ];

  // Don't send if it's an AI message
  if (aiUserIds.includes(message.user_id)) {
    console.log('Skipping AI message from backend send:', message.user_id);
    return false;
  }

  if (aiUserNames.includes(message.user_name)) {
    console.log('Skipping AI message from backend send:', message.user_name);
    return false;
  }

  return true;
}

// Usage
transcripts.forEach(transcript => {
  if (shouldSendToBackend(transcript)) {
    // Send to backend
    fetch('/api/trigger-groq', { ... });
  } else {
    // Just display in UI, don't send to backend
    displayInUI(transcript);
  }
});
```

---

## Issue 2: "Fetching response..." for Blocked Messages

**Problem**: When backend blocks a message or skips a response, the UI shows "Fetching response..." and never clears it.

**Current behavior**:
```
Backend returns: { success: true, detected: false, response: null }
→ Frontend shows: "Fetching response..."
→ Never clears
```

**Solution**: Check `detected` field and `response` field to determine if there's actually a response to show.

### Frontend Code Needed

```javascript
async function handleBackendResponse(response) {
  // Response format:
  // {
  //   success: true,
  //   detected: true/false,
  //   response: "..." or null,
  //   skipped: true/false (optional),
  //   blocked: true/false (optional)
  // }

  // Remove loading spinner
  hideLoadingSpinner();

  // Check if there's actually a response to show
  if (response.skipped || response.blocked || !response.detected) {
    console.log('No response to show:', response.message || 'Skipped/blocked');
    // Don't show anything - just return silently
    return;
  }

  // Check if response is null or empty
  if (!response.response) {
    console.log('No response content');
    return;
  }

  // Show the actual response
  displayResponse(response.response);
}
```

### Loading State Logic

```javascript
// When sending request
function sendToBackend(message) {
  // Only show loading if it's a real user message
  if (message.user_id !== 'manual-user' &&
      message.user_id !== 'zoom-user') {
    // Don't show loading for AI messages
    return;
  }

  showLoadingSpinner();

  fetch('/api/trigger-groq', { ... })
    .then(response => response.json())
    .then(data => handleBackendResponse(data))
    .catch(error => {
      hideLoadingSpinner();
      showError(error);
    });
}
```

---

## Complete Example

```javascript
// Complete flow for handling transcripts
function processTranscript(transcript) {
  // STEP 1: Display in UI (always)
  displayInTranscriptFeed(transcript);

  // STEP 2: Check if we should send to backend
  if (!shouldSendToBackend(transcript)) {
    console.log('AI message - not sending to backend');
    return;
  }

  // STEP 3: Only show loading for real user messages
  if (transcript.user_id === 'manual-user' ||
      transcript.user_id === 'zoom-user') {
    showLoadingSpinner();
  }

  // STEP 4: Send to backend
  fetch('/api/trigger-groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: transcript.data,
      user_name: transcript.user_name,
      user_id: transcript.user_id,
      // ... other fields
    })
  })
  .then(response => response.json())
  .then(data => {
    hideLoadingSpinner();

    // Check if there's a response to show
    if (data.skipped || data.blocked || !data.detected || !data.response) {
      console.log('No response to show');
      return;
    }

    // Show the response
    displayResponse(data.response);
  })
  .catch(error => {
    hideLoadingSpinner();
    showError('Failed to process request');
  });
}
```

---

## Response Format Reference

### Backend Response Types

**Normal response**:
```json
{
  "success": true,
  "detected": true,
  "response": "The weather in SF is...",
  "tools": [...],
  "routing": {...}
}
```

**Skipped response** (router decided not to respond):
```json
{
  "success": true,
  "detected": false,
  "skipped": true,
  "response": null,
  "reasoning": "Casual greeting"
}
```

**Blocked message** (AI message sent to backend):
```json
{
  "success": true,
  "detected": false,
  "response": null,
  "message": "",
  "tools": []
}
```

---

## Testing

### Test 1: User Message
```
User: "hey sup"
✅ Shows in transcript feed
✅ Sent to backend
✅ Router decides to skip
✅ No "Fetching response..." shown
✅ No assistant response shown
```

### Test 2: Router Decision
```
Router Decision: "💭 Skipping: ..."
✅ Shows in action feed
❌ NOT sent to backend (filtered)
✅ No "Fetching response..." shown
✅ No error
```

### Test 3: Normal Response
```
User: "what's the weather in SF?"
✅ Shows in transcript feed
✅ Sent to backend
✅ Shows "Fetching response..."
✅ Router decides to respond
✅ Shows assistant response
✅ "Fetching response..." cleared
```

---

## Summary

**Frontend needs to**:
1. ✅ Filter AI messages before sending to backend
2. ✅ Only show loading for real user messages
3. ✅ Check `detected` and `response` fields before showing response
4. ✅ Handle `skipped`/`blocked` responses silently

**Backend is already**:
1. ✅ Blocking AI messages correctly
2. ✅ Returning proper response format
3. ✅ Preventing feedback loops

The issue is entirely on the frontend side - it needs to respect the backend's response format and not send AI messages in the first place.

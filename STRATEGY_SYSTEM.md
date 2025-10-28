# Pluggable Response Strategy System

## Overview
This system allows users to control how "eager" or "reluctant" the AI is when responding to messages and discovering background information.

## Strategy Levels (for both Hey Zoom & Discovery)

1. **Everything!!!** - Responds/discovers for absolutely everything
2. **Eager!** - Proactively responds/discovers for most things
3. **Reluctant.** - Selective, current default behavior
4. **Shy...** - Very conservative, minimal responses/discoveries

## Implementation Status

### ✅ Completed

1. **Created `/utils/response-strategies.js`**
   - Defines HEYZOOM_STRATEGIES and DISCOVERY_STRATEGIES
   - Each strategy has:
     - `id`: 'everything' | 'eager' | 'reluctant' | 'shy'
     - `label`: Display name
     - `description`: User-facing description
     - `systemPrompt`: AI system message
     - `evaluationRules`: Rules for decision-making
     - `temperature`: Model temperature
     - `maxInsights`: (Discovery only) Max insights per request

2. **Updated `/utils/heyzoom-decision-utils.js`**
   - Added import for `getHeyZoomStrategy`
   - Updated `evaluateResponseNeed` to accept `strategy` parameter
   - Uses strategy's `systemPrompt`, `evaluationRules`, and `temperature`

3. **Updated `/utils/discovery-cache-utils.js`**
   - Added import for `getDiscoveryStrategy`
   - Updated `evaluateDiscoveryNeed` to accept `strategy` parameter
   - Uses strategy's `systemPrompt`, `evaluationRules`, `temperature`, and `maxInsights`

4. **Updated `main.js` API endpoints**
   - `/api/trigger-groq`: Accepts `hey_zoom_strategy` parameter (default: 'reluctant')
   - `/api/discovery-analysis`: Accepts `discovery_strategy` parameter (default: 'reluctant')
   - Both endpoints pass strategy to evaluation functions

### 🚧 Remaining Tasks

1. **Add UI controls in `/frontend/index.html`**
   - Add two dropdown/radio controls in settings panel:
     - "Hey Zoom Response Strategy"
     - "Discovery Feed Strategy"
   - Store selections in Alpine.js data (e.g., `heyZoomStrategy`, `discoveryStrategy`)
   - Persist selections in localStorage
   - Default both to 'reluctant'

2. **Update frontend API calls**
   - In `sendTriggerRequest()`: Include `hey_zoom_strategy: this.heyZoomStrategy`
   - In `runDiscoveryAnalysis()`: Include `discovery_strategy: this.discoveryStrategy`

3. **Add visual indicators (optional)**
   - Show current strategy in the UI (e.g., badge next to toggle)
   - Update action feed/discovery feed to show which strategy was used

## Frontend Changes Needed

### 1. Add to Alpine.js data (around line 1450)
```javascript
heyZoomStrategy: localStorage.getItem('heyZoomStrategy') || 'reluctant',
discoveryStrategy: localStorage.getItem('discoveryStrategy') || 'reluctant',
```

### 2. Add strategy dropdowns in settings panel (around line 195-210)
```html
<!-- Hey Zoom Strategy -->
<div class="flex items-center justify-between py-2">
  <label class="text-xs text-gray-600">Hey Zoom Response Strategy:</label>
  <select
    x-model="heyZoomStrategy"
    @change="localStorage.setItem('heyZoomStrategy', heyZoomStrategy)"
    class="text-xs px-2 py-1 border rounded"
  >
    <option value="everything">Everything!!!</option>
    <option value="eager">Eager!</option>
    <option value="reluctant">Reluctant.</option>
    <option value="shy">Shy...</option>
  </select>
</div>

<!-- Discovery Strategy -->
<div class="flex items-center justify-between py-2">
  <label class="text-xs text-gray-600">Discovery Feed Strategy:</label>
  <select
    x-model="discoveryStrategy"
    @change="localStorage.setItem('discoveryStrategy', discoveryStrategy)"
    class="text-xs px-2 py-1 border rounded"
  >
    <option value="everything">Everything!!!</option>
    <option value="eager">Eager!</option>
    <option value="reluctant">Reluctant.</option>
    <option value="shy">Shy...</option>
  </select>
</div>
```

### 3. Update sendTriggerRequest() (around line 2850-2900)
Add to the fetch body:
```javascript
hey_zoom_strategy: this.heyZoomStrategy
```

### 4. Update runDiscoveryAnalysis() (around line 1630-1640)
Add to the fetch body:
```javascript
discovery_strategy: this.discoveryStrategy
```

## Testing

1. **Test Hey Zoom Strategies**
   - everything: Should respond to "ok", "thanks", casual chat
   - eager: Should respond to most questions and statements
   - reluctant: Should respond only to explicit questions/requests (current behavior)
   - shy: Should barely respond, only to urgent explicit requests

2. **Test Discovery Strategies**
   - everything: Should discover for every topic mentioned
   - eager: Should discover for most people/companies/topics
   - reluctant: Should discover selectively (current behavior)
   - shy: Should rarely discover, only critical entities

## Files Modified

- ✅ `/utils/response-strategies.js` (NEW)
- ✅ `/utils/heyzoom-decision-utils.js`
- ✅ `/utils/discovery-cache-utils.js`
- ✅ `/main.js`
- 🚧 `/frontend/index.html` (needs UI controls and API call updates)

## Benefits

- User control over AI behavior
- Different strategies for different use cases
- Preserves current "reluctant" behavior as default
- Easy to add new strategies in the future
- Separate controls for responses vs discovery

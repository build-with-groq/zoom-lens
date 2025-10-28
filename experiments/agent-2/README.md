# Agent-2: Poke-Inspired Orchestration Architecture

> **The "Not Too Eager" Agent**: Separating eager execution from thoughtful presentation

## The Problem

Agent-1 has a "too excited to help" problem:
- Responds to every message, even when silence is better
- Discovery mode triggers constantly, creating noise
- No filtering between "I found something!" and "Should I tell the user?"
- Tight loop means it's always ready to jump in

**Example Issue:**
```
User: "ok thanks"
Agent-1: "You're welcome! Is there anything else I can help with?
         I'm here to assist with Salesforce, web search, weather..."
```

The agent should have just stayed silent. This is exhausting for users.

## The Solution: Poke's Architecture

Inspired by [Poke's multi-agent architecture](https://shlokkhemani.com/writing/openpoke), Agent-2 implements:

1. **Interaction Agent** (Gatekeeper)
   - Decides what reaches the user
   - Controls personality and UX
   - Can invoke "wait" to stay silent
   - Filters outputs from workers

2. **Execution Agent** (Worker)
   - Can be eager and thorough
   - Pure functional, no personality
   - Does the actual work
   - Doesn't worry about presentation

3. **Clean Separation**
   - Eager execution is OK (Execution Agent)
   - Thoughtful filtering keeps it from being annoying (Interaction Agent)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER MESSAGE                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │    INTERACTION AGENT              │
        │    (Gatekeeper/Filter)            │
        │                                   │
        │  ❓ Should I respond at all?      │
        │  ❓ Is this worth my attention?   │
        └──────────────┬───────────────────┘
                       │
                       │ Yes → Execute
                       ▼
        ┌──────────────────────────────────┐
        │    EXECUTION AGENT                │
        │    (Eager Worker)                 │
        │                                   │
        │  ✅ Call tools liberally          │
        │  ✅ Be thorough                   │
        │  ✅ Don't worry about UX          │
        └──────────────┬───────────────────┘
                       │
                       │ Raw output
                       ▼
        ┌──────────────────────────────────┐
        │    INTERACTION AGENT              │
        │    (Filter Output)                │
        │                                   │
        │  ❓ Is this relevant?             │
        │  ❓ Is this actionable?           │
        │  ❓ Is this novel?                │
        └──────────────┬───────────────────┘
                       │
                       ├─ No → WAIT (silent)
                       │
                       └─ Yes → Apply personality
                              │
                              ▼
                    ┌──────────────────────┐
                    │   USER RESPONSE       │
                    └──────────────────────┘
```

## Key Features

### 1. Response Necessity Evaluation

Before doing ANY work, the Interaction Agent asks:

```javascript
{
  shouldRespond: false,
  reasoning: "User message is just acknowledgment ('ok thanks')",
  confidence: 0.95,
  responseType: "acknowledgment"
}
```

**Stay silent if:**
- Just acknowledgment: "ok", "thanks", "got it"
- Side conversation with someone else
- Rhetorical or doesn't need response
- Recent responses already addressed this

**Respond if:**
- Direct question or request
- Important information that needs acknowledgment
- Clarification needed
- User seems stuck

### 2. Output Filtering

Even if we execute, we filter the output before showing it:

```javascript
{
  shouldShow: false,
  scores: {
    relevance: 4,      // Too low (threshold: 7)
    actionability: 3,  // Too low (threshold: 6)
    novelty: 2         // Too low (threshold: 5)
  },
  reasoning: "This is tangentially related but not actionable"
}
```

### 3. Discovery Filtering

Discovery mode can run in background (eager!), but findings are filtered:

```javascript
// 10 discoveries found → Interaction Agent filters → 2 shown

{
  discoveries: [
    {
      id: "disc-1",
      finding: "User mentioned Bob 3 times - might be important contact",
      scores: { importance: 8, actionability: 7, novelty: 6 },
      shouldShow: true,
      priority: "high"
    },
    {
      id: "disc-2",
      finding: "Weather was discussed yesterday",
      scores: { importance: 3, actionability: 2, novelty: 1 },
      shouldShow: false
    }
  ]
}
```

**Thresholds:**
- Importance >= 7
- Actionability >= 6
- Novelty >= 5

### 4. Personality Application

Only AFTER filtering, apply personality:

```javascript
// Raw (from Execution Agent):
"I have successfully created a draft email to Alice Smith
regarding the meeting request. The draft has been prepared
and is ready for your review."

// Personalized (from Interaction Agent):
"Drafted your email to Alice about the meeting. Want to see it?"
```

## Configuration

See `agent-2-config.js` for all settings:

```javascript
// Interaction Agent
export const INTERACTION_AGENT_CONFIG = {
  model: 'llama-3.3-70b-versatile',
  personality: {
    tone: 'sharp, witty, direct',
    principle: 'don\'t act like sycophantic chatbots'
  },
  filtering: {
    discoveryThreshold: {
      minImportance: 7,
      minActionable: 6,
      minNovel: 5
    }
  }
};

// Execution Agent
export const EXECUTION_AGENT_CONFIG = {
  model: 'openai/gpt-oss-120b',
  personality: null,  // NO personality
  executionStyle: {
    thoroughness: 'high',
    toolUsage: 'liberal'  // OK to be eager!
  }
};

// Discovery
export const DISCOVERY_CONFIG = {
  filteringEnabled: true,
  maxDiscoveriesPerHour: 3,      // Rate limit
  minTimeBetweenDiscoveries: 300000  // 5 min gap
};
```

## Usage Example

### Old Way (Agent-1):
```javascript
// Every message triggers full execution
const result = await performGroqInference(transcript, userName, ...);
// Always responds, even to "ok thanks"
```

### New Way (Agent-2):
```javascript
import { orchestrateInteraction } from '../../utils/interaction-agent-utils.js';

const result = await orchestrateInteraction(groqClient, {
  userMessage: transcript,
  recentMessages: chatHistory,
  executionFunction: async () => {
    // Execution Agent does the work
    return await performExecution(transcript);
  },
  filteringConfig: INTERACTION_AGENT_CONFIG.filtering,
  personalityConfig: INTERACTION_AGENT_CONFIG.personality
});

if (result === null) {
  // Interaction Agent decided to WAIT (stay silent)
  console.log('⏭️ Not responding to this message');
  return;
}

// result.response is filtered and personalized
return result.response;
```

## Benefits

### 1. Less Noise
User: "ok"
Agent-1: [Long response about how it can help]
Agent-2: [silence] ✅

### 2. Better Discovery
Agent-1: Shows 10 discoveries per minute
Agent-2: Filters to 2-3 high-value discoveries per hour ✅

### 3. Cleaner UX
Agent-1: "I have successfully completed your request and created..."
Agent-2: "Done. Here's the draft." ✅

### 4. Separated Concerns
- Execution Agent can be thorough without being annoying
- Interaction Agent controls what reaches user
- Easy to tune filtering without touching execution
- Easy to change personality without breaking tools

## Comparison with Agent-1

| Feature | Agent-1 | Agent-2 |
|---------|---------|---------|
| **Architecture** | Single agent | Interaction + Execution |
| **Response to "ok thanks"** | Always responds | Stays silent ✅ |
| **Discovery filtering** | Shows all findings | Filters by importance ✅ |
| **Personality** | Mixed with execution | Separated layer ✅ |
| **Tool calling** | Conservative | Can be liberal (filtered) ✅ |
| **Noise level** | High | Low ✅ |

## Implementation Status

- ✅ Configuration defined
- ✅ Interaction Agent utilities created
- ✅ Filtering functions implemented
- ⏳ Integration with agent-2-inference.js (TODO)
- ⏳ Discovery filtering (TODO)
- ⏳ Testing and tuning (TODO)

## Next Steps

1. **Create agent-2-inference.js**
   - Import from interaction-agent-utils
   - Wrap existing performGroqInference with orchestration
   - Separate Execution Agent logic

2. **Update Discovery Mode**
   - Make it run in background (eager)
   - Filter through Interaction Agent
   - Apply rate limiting

3. **Tune Thresholds**
   - Test with real usage
   - Adjust filtering scores
   - Balance between helpful and quiet

4. **Add Metrics**
   - Track how often we "wait"
   - Measure response necessity accuracy
   - Monitor filter effectiveness

## Key Learnings from Poke

1. **Separate personality from execution** - Makes both better
2. **Embrace asynchrony** - Workers can do work without blocking UX
3. **Filter aggressively** - Better to stay silent than be annoying
4. **Persistence matters** - Each worker owns a thread of work
5. **Context is everything** - Different memory for different purposes

## Credits

Architecture inspired by:
- [OpenPoke by Shlok Khemani](https://shlokkhemani.com/writing/openpoke)
- [Poke by Interaction Company](https://poke.com)

Lessons learned:
- Don't conflate eagerness with annoyance
- Filtering is as important as execution
- Users prefer silence over noise
- Personality should be a layer, not mixed in

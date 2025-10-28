# Discovery Feed: Conversation-Value Focus Update

## Overview
Refactored Discovery Feed from entity-extraction focused to **conversation-value focused**. Discovery now prioritizes engaging, relevant information that adds value to discussions rather than just extracting person/company/product names.

## Key Philosophy Change

### Before
- ❌ Entity-focused: "Find person names, company names, products"
- ❌ Salesforce-first: "Always use Salesforce for names"
- ❌ Pattern matching: Look for specific entity types

### After
- ✅ Value-focused: "Does this add value to the conversation?"
- ✅ Tool-agnostic: Use Salesforce OR web search - whatever is most relevant
- ✅ Question-driven: Focus on answering questions and enriching discussions
- ✅ Engagement-driven: Prioritize interesting, relevant, timely information

## Changes Made

### 1. Updated Strategy Prompts (`/utils/response-strategies.js`)

**Reluctant Strategy (default):**
- Now focuses on: Active questions, topics being discussed, current events, decision support
- Key criteria: "Will this make the conversation better?"
- Uses Salesforce for business context, web search for general/current info

**Eager Strategy:**
- Looks for opportunities to enrich conversations
- Researches questions, topics of interest, contextual opportunities
- Prioritizes engaging, interesting information

### 2. Updated Discovery Evaluation (`/utils/discovery-cache-utils.js`)

**Main Discovery Prompt:**
- Changed from "provide background about people/companies" to "provide ENGAGING, VALUE-ADDING context"
- Tool descriptions updated:
  - Salesforce: "Use for business context"
  - Groq Compound: "Use for current events, general knowledge, technical topics"
  - Weather: "Use for location-based weather"

### 3. Added Reflection Loop (`/main.js`)

**NEW: Value Evaluation Step**

After getting discovery results but before displaying them:

1. **Reflection Prompt**: Evaluates if research adds value
   - Does it answer a question being asked?
   - Does it provide useful context?
   - Is it interesting and relevant?
   - Would users find it helpful?

2. **Decision**:
   - If `adds_value: true` → Process and display
   - If `adds_value: false` → Skip silently

3. **Benefits**:
   - Filters out generic/obvious information
   - Prevents noise in the feed
   - Ensures only valuable insights are shown
   - Self-correcting system that learns what's useful

## Use Cases Now Supported

### ✅ Questions
User: "How do F1 drivers score points?"
→ Discovery: Researches F1 points system

### ✅ Current Events
User: "Did you see the news about the new AI model?"
→ Discovery: Looks up recent AI model announcements

### ✅ Technical Discussions
User: "We're considering using React for this project"
→ Discovery: Provides React overview, current version, pros/cons

### ✅ Business Context
User: "Meeting with Acme Corp tomorrow"
→ Discovery: Checks Salesforce for Acme Corp info + web search for recent news

### ✅ Decision Support
User: "Should we deploy on Friday or Monday?"
→ Discovery: Could provide best practices for deployment timing

## What Gets Filtered Out

The reflection loop now prevents:
- Generic information not relevant to the discussion
- Obvious facts that don't add new context
- Research that doesn't answer any questions
- Information that would be noise rather than signal

## Tool Selection Logic

Discovery now intelligently chooses tools:

1. **Salesforce**: When business context is needed (people, companies, deals)
2. **Web Search (Groq Compound)**: For current events, general knowledge, technical topics, news
3. **Weather**: For location-based weather

No more "Salesforce first" bias - the tool should match the need!

## Testing the New Behavior

### Test Scenarios

1. **Ask a question**: "What's the weather in SF?"
   - Should trigger discovery with weather tool
   - Should show result if relevant

2. **Discuss a company**: "Talking to Salesforce about their CRM"
   - Should check Salesforce CRM + web for recent news
   - Only shows if adds business context

3. **Casual chat**: "Hey, how are you?"
   - Should NOT trigger discovery
   - Or if it does, reflection should filter it out

4. **Technical topic**: "How does React handle state?"
   - Should trigger web search
   - Shows if provides useful technical context

## Benefits

1. **More Engaging**: Discovery focuses on interesting, valuable information
2. **Less Noise**: Reflection loop filters out generic content
3. **Question-Driven**: Better at answering actual user questions
4. **Smarter Tool Use**: Uses the right tool for the job
5. **Self-Correcting**: Reflection provides feedback loop for quality

## Configuration

Users can still control eagerness with strategy settings:
- **Everything**: Discovers for every topic (still filtered by reflection)
- **Eager**: Proactively discovers for most topics
- **Reluctant**: Selective, value-focused (default)
- **Shy**: Very conservative, essential info only

## Future Improvements

Potential enhancements:
1. Learn from user engagement (which discoveries get clicked/read)
2. Personalize based on conversation history
3. Add more specialized research tools
4. Fine-tune reflection criteria based on feedback
5. Cache reflection decisions to improve over time

## Files Modified

- ✅ `/utils/response-strategies.js` - Updated strategy prompts
- ✅ `/utils/discovery-cache-utils.js` - Updated evaluation prompts
- ✅ `/main.js` - Added reflection loop with value evaluation

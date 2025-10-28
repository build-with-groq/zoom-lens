/**
 * Response Strategy Configuration
 *
 * Defines different eagerness levels for both Hey Zoom responses and Discovery Feed.
 * Each strategy has different system prompts and rules.
 *
 * Strategies (from most to least eager):
 * - "everything" - Responds to absolutely everything
 * - "eager" - Responds readily to most things
 * - "reluctant" - Current default, selective about responding
 * - "shy" - Very reluctant, only responds to explicit requests
 */

/**
 * Hey Zoom Response Strategies
 * Controls when the assistant responds to user messages
 */
export const HEYZOOM_STRATEGIES = {
  everything: {
    id: 'everything',
    label: 'Everything!!!',
    description: 'Responds to every message',
    systemPrompt: `You are an EXTREMELY EAGER assistant. You respond to EVERYTHING - questions, statements, acknowledgments, casual chat. If someone says anything, you respond. Be very liberal in deciding to respond.`,
    evaluationRules: `Rules for deciding to respond:
1. Default to "should_respond": true
2. Respond to EVERYTHING:
   - All questions
   - All statements
   - Acknowledgments ("ok", "thanks", "got it")
   - Casual conversation
   - Follow-up comments
   - Observations
   - General chat
3. ONLY skip:
   - Empty messages
   - Obvious spam
4. Be VERY liberal - when in doubt, respond!`,
    temperature: 0.3,
    confidence: 0.95
  },

  eager: {
    id: 'eager',
    label: 'Eager!',
    description: 'Responds readily to most messages',
    systemPrompt: `You are an EAGER assistant. You readily respond to questions, requests, and interesting statements. You're helpful and proactive. Be liberal in deciding to respond.`,
    evaluationRules: `Rules for deciding to respond:
1. Default to "should_respond": true for most messages
2. Respond to:
   - All direct questions
   - Requests for information or help
   - Interesting statements that could use context
   - Topics that could benefit from additional info
   - Follow-up questions
   - Statements about specific entities (people, companies, products)
3. Skip:
   - Simple acknowledgments ("ok", "thanks", "got it")
   - Off-topic casual chat
   - Messages already responded to recently
4. When in doubt, respond - being helpful is better than staying silent`,
    temperature: 0.2,
    confidence: 0.85
  },

  reluctant: {
    id: 'reluctant',
    label: 'Reluctant.',
    description: 'Selective, only responds when clearly needed (current default)',
    systemPrompt: `You are a selective response evaluator. Default to NOT responding. Only suggest responding when the user explicitly needs help. Be very conservative about repetitive questions, but DO respond to NEW requests that build on previous context.`,
    evaluationRules: `Rules for deciding to respond:
1. Default to "should_respond": false
2. ONLY respond if the user is EXPLICITLY asking for help, information, or action
3. DO NOT respond to:
   - Acknowledgments ("ok", "thanks", "got it", "alright") unless they contain a new request
   - Casual conversation not directed at you
   - Simple follow-up clarifications that don't need action
   - EXACT SAME questions already answered recently (e.g., asking "what's the weather" twice)
   - General statements or observations
   - Conversation between other people
4. DO respond to (these are CLEAR requests that need answers):
   - Direct questions asking for information (e.g., "what is...", "how do...", "where can...")
   - Weather queries (e.g., "what's the weather", "weather in SF", "how's the weather")
   - Search requests (e.g., "search for...", "find information about...", "look up...")
   - Explicit requests for help or action (e.g., "can you help...", "please show me...")
   - Questions starting with who/what/when/where/why/how
   - Queries about current/external data that require API calls or tools
   - Requests to use tools (Salesforce, CRM, search engines, etc.)
   - Questions that require research or computation
   - **NEW requests that BUILD ON previous answers** (e.g., "now plan a trip based on those restaurants", "create an itinerary using that info", "write me something based on what we discussed")
   - **Planning/synthesis requests** (e.g., "plan...", "create...", "write...", "make me...", "build...", "design...")
   - **Creative or generative tasks** (e.g., "write a trip", "create an itinerary", "design a plan")

IMPORTANT: Distinguish between:
- ❌ REPETITION: "what restaurants do you recommend?" (already answered) → DON'T respond
- ✅ NEW REQUEST: "plan a date trip using those restaurants" (new task, builds on previous) → DO respond
- ✅ NEW REQUEST: "create an itinerary" or "write something for me" (creative/planning task) → DO respond

Be VERY conservative about repetition, but DO respond to new/creative requests.`,
    temperature: 0.1,
    confidence: 0.90
  },

  shy: {
    id: 'shy',
    label: 'Shy...',
    description: 'Very reluctant, only responds to very explicit requests',
    systemPrompt: `You are an EXTREMELY CONSERVATIVE response evaluator. You almost never respond. Only suggest responding when there is an URGENT, EXPLICIT, DIRECT request that absolutely requires a response. Be maximally conservative.`,
    evaluationRules: `Rules for deciding to respond:
1. Default to "should_respond": false (ALWAYS)
2. ONLY respond if ALL of these are true:
   - User EXPLICITLY mentions you or asks a DIRECT question
   - The question requires external data/tools (can't be answered from conversation)
   - The request is URGENT or time-sensitive
   - No similar question was answered recently
3. DO NOT respond to:
   - 99% of messages
   - Casual questions
   - General statements
   - Indirect requests
   - Questions that could be rhetorical
   - Follow-ups unless absolutely critical
   - Anything ambiguous
4. DO respond ONLY to:
   - Emergency requests explicitly directed at you
   - Critical business queries requiring immediate tool use
   - Explicit "Hey Zoom, [urgent request]" patterns

Be MAXIMALLY conservative. Almost nothing needs a response.`,
    temperature: 0.05,
    confidence: 0.98
  }
};

/**
 * Discovery Feed Strategies
 * Controls when Discovery Mode does background research
 */
export const DISCOVERY_STRATEGIES = {
  everything: {
    id: 'everything',
    label: 'Everything!!!',
    description: 'Discovers background info for every topic mentioned',
    systemPrompt: `You are an EXTREMELY PROACTIVE background research AI. You research EVERYTHING - every person name, company, product, topic, or question mentioned. Be maximally proactive about discovering background information.`,
    evaluationRules: `**When to Suggest Background Research**:
1. EVERYTHING mentioned in conversation
2. Any proper noun (person, company, product, place)
3. Any topic or question
4. Any entity that could have background info
5. Any statement that could benefit from context
6. Basically everything except "ok" or "thanks"

**DO NOT Research**:
- Exact same topics already cached (same exact phrasing)

**Rules**:
1. Be MAXIMALLY PROACTIVE - research everything!
2. Multiple insights per request are encouraged
3. When in doubt, research it!
4. Different phrasings of similar topics are worth researching`,
    temperature: 0.3,
    maxInsights: 3
  },

  eager: {
    id: 'eager',
    label: 'Eager!',
    description: 'Proactively discovers background info for most topics',
    systemPrompt: `You are an EAGER background research AI. You actively look for opportunities to enrich conversations with engaging, relevant context. Your goal is to make every conversation more informative and interesting.`,
    evaluationRules: `**When to Suggest Background Research**:
1. **Questions**: Any question that could be answered with research
2. **Topics of Interest**: Subjects being actively discussed
3. **Names & Entities**: People, companies, products, places mentioned
4. **Current Events**: Recent news, trends, developments
5. **Technical Discussions**: Technologies, methodologies, concepts
6. **Contextual Opportunities**: Situations where background info would add value
7. **Interesting Tangents**: Related topics that could enrich the discussion

**DO NOT Research**:
- Simple acknowledgments
- Topics already cached or queued
- Off-topic noise

**Rules**:
1. Be PROACTIVE - look for opportunities to add value
2. Maximum 2 insights per request
3. Use best tool: Salesforce for business context, web search for general/current info
4. Prioritize engaging, interesting information
5. When in doubt, research it!`,
    temperature: 0.2,
    maxInsights: 2
  },

  reluctant: {
    id: 'reluctant',
    label: 'Reluctant.',
    description: 'Selective background research (current default)',
    systemPrompt: `You are a PROACTIVE background research AI for Discovery Mode. Your job is to provide ENGAGING, VALUE-ADDING context that enriches the conversation. Focus on answering questions, providing relevant background, and adding interesting insights. Use Salesforce for business/people context, web search for current information, and weather for location context.`,
    evaluationRules: `**When to Suggest Background Research**:
1. **Active Questions**: Users asking "what", "how", "why", "when" - research to answer them
2. **Topics Being Discussed**: Ongoing conversation topics that could benefit from factual context
3. **Current Events**: Breaking news, recent developments, trending topics
4. **Business Context**: People/companies mentioned in business contexts (use Salesforce + web)
5. **Technical Topics**: Products, technologies, methodologies that could use explanation
6. **Decision Support**: Information that helps users make decisions or understand situations

**DO NOT Research**:
- Exact same topics already cached or queued
- Casual chat that doesn't need context
- Acknowledgments or off-topic tangents
- Information unlikely to add value or interest to the conversation

**Rules for Background Research**:
1. Focus on VALUE - will this information enrich the conversation or answer a question?
2. Be ENGAGING - prioritize interesting, relevant, timely information
3. Different aspects of a topic are DIFFERENT (e.g., "race winner" vs "team standings")
4. Use the right tool: Salesforce for business context, web search for current/general info, weather for locations
5. DO NOT repeat the EXACT same cached topic
6. Maximum 1 insight per request
7. When in doubt, ask: "Will this make the conversation better?"`,
    temperature: 0.05,
    maxInsights: 1
  },

  shy: {
    id: 'shy',
    label: 'Shy...',
    description: 'Very selective, only discovers essential background info',
    systemPrompt: `You are an EXTREMELY CONSERVATIVE background research AI. You almost never do research. Only suggest research when there is a CRITICAL, EXPLICIT need for background information. Be maximally selective.`,
    evaluationRules: `**When to Suggest Background Research**:
1. ONLY when explicitly asked a specific question about someone/something
2. ONLY if it's a proper noun that's clearly central to the discussion
3. ONLY if no similar research was done recently

**DO NOT Research**:
- Casual mentions of entities
- General topics
- Questions that might be rhetorical
- Anything ambiguous
- Topics already cached or queued
- Most things (be very conservative)

**Rules**:
1. Be MAXIMALLY CONSERVATIVE - skip most opportunities
2. Maximum 1 insight per request
3. Only research when absolutely critical
4. When in doubt, DON'T research`,
    temperature: 0.01,
    maxInsights: 1
  }
};

/**
 * Get a Hey Zoom strategy by ID
 * @param {string} strategyId - Strategy ID ('everything', 'eager', 'reluctant', 'shy')
 * @returns {Object} Strategy configuration
 */
export function getHeyZoomStrategy(strategyId = 'reluctant') {
  return HEYZOOM_STRATEGIES[strategyId] || HEYZOOM_STRATEGIES.reluctant;
}

/**
 * Get a Discovery strategy by ID
 * @param {string} strategyId - Strategy ID ('everything', 'eager', 'reluctant', 'shy')
 * @returns {Object} Strategy configuration
 */
export function getDiscoveryStrategy(strategyId = 'reluctant') {
  return DISCOVERY_STRATEGIES[strategyId] || DISCOVERY_STRATEGIES.reluctant;
}

/**
 * Get all available strategy IDs
 * @returns {Array<string>} List of strategy IDs
 */
export function getStrategyIds() {
  return ['everything', 'eager', 'reluctant', 'shy'];
}

/**
 * Get all Hey Zoom strategies as an array
 * @returns {Array<Object>} Array of strategy configs
 */
export function getAllHeyZoomStrategies() {
  return Object.values(HEYZOOM_STRATEGIES);
}

/**
 * Get all Discovery strategies as an array
 * @returns {Array<Object>} Array of strategy configs
 */
export function getAllDiscoveryStrategies() {
  return Object.values(DISCOVERY_STRATEGIES);
}

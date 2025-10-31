/**
 * Interaction Agent Utilities
 * Poke-inspired gatekeeper that filters what reaches the user
 *
 * Key Principle: Separate eager execution from thoughtful presentation
 *
 * The Interaction Agent:
 * - Evaluates whether to respond at all
 * - Filters outputs from Execution Agents
 * - Controls personality and UX
 * - Can invoke "wait" to stay silent
 */

/**
 * Evaluate if a user message requires a response
 *
 * @param {Object} groqClient - Groq client
 * @param {Object} config - Configuration
 * @param {string} config.userMessage - User's message
 * @param {Array} config.recentMessages - Recent conversation history
 * @param {Object} config.context - Additional context
 * @returns {Promise<Object>} Decision object with shouldRespond, reasoning, confidence
 */
export async function evaluateResponseNecessity(groqClient, config) {
  const {
    userMessage,
    recentMessages = [],
    context = {}
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 INTERACTION AGENT: Evaluating response necessity`);
  console.log(`   Message: "${userMessage.substring(0, 100)}..."`);
  console.log(`${'='.repeat(80)}`);

  const systemPrompt = `You are the Interaction Agent - a gatekeeper that decides what reaches the user.

Your job is to evaluate whether the AI assistant should respond to this message.

STAY SILENT (shouldRespond: false) if:
- Message is just acknowledgment: "ok", "thanks", "got it", "cool"
- Message is side conversation with someone else (not directed at AI)
- Message is rhetorical or doesn't need response
- Message is part of ongoing conversation that doesn't need interruption
- Recent responses already addressed this

RESPOND (shouldRespond: true) if:
- Direct question or request to AI
- Important information that needs acknowledgment
- Clarification needed
- User seems stuck or confused
- Significant time has passed since last interaction

Return JSON:
{
  "shouldRespond": boolean,
  "reasoning": "why or why not",
  "confidence": 0-1,
  "responseType": "question|request|acknowledgment|conversation|other"
}`;

  // Build context from recent messages
  const recentContext = recentMessages.slice(0, 10).map(msg =>
    `[${msg.user_name}]: ${msg.data}`
  ).join('\n');

  try {
    const response = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Recent conversation:\n${recentContext}\n\nNew message: "${userMessage}"\n\nShould the AI respond?`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const decision = JSON.parse(response.choices[0]?.message?.content);

    console.log(`   Decision: ${decision.shouldRespond ? '✅ RESPOND' : '⏭️ WAIT'}`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    console.log(`   Confidence: ${decision.confidence}`);

    return decision;

  } catch (error) {
    console.error(`❌ Response necessity evaluation failed:`, error);
    // Default to responding if evaluation fails
    return {
      shouldRespond: true,
      reasoning: 'Evaluation failed, defaulting to respond',
      confidence: 0.5,
      responseType: 'other'
    };
  }
}

/**
 * Evaluate if execution output should be shown to user
 * (Filter outputs from Execution Agents or discovery)
 *
 * @param {Object} groqClient - Groq client
 * @param {Object} config - Configuration
 * @param {string} config.executionOutput - Output from Execution Agent
 * @param {string} config.originalQuery - Original user query
 * @param {Array} config.recentMessages - Recent conversation
 * @param {Object} config.thresholds - Filtering thresholds
 * @returns {Promise<Object>} Filter decision
 */
export async function evaluateOutputRelevance(groqClient, config) {
  const {
    executionOutput,
    originalQuery,
    recentMessages = [],
    thresholds = {
      relevance: 7,
      actionability: 6,
      novelty: 5
    }
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 INTERACTION AGENT: Evaluating output relevance`);
  console.log(`   Output preview: "${executionOutput.substring(0, 100)}..."`);
  console.log(`${'='.repeat(80)}`);

  const systemPrompt = `You are the Interaction Agent - a gatekeeper that filters what reaches the user.

Your job is to evaluate whether this execution output should be shown to the user.

Evaluate on three dimensions (1-10 scale):

1. RELEVANCE: Is this relevant to the user's question/conversation?
   - 10: Directly answers user's question
   - 7: Related and useful
   - 5: Tangentially related
   - 3: Not really relevant
   - 1: Completely off-topic

2. ACTIONABILITY: Can the user do something with this?
   - 10: Immediate action required
   - 7: Useful for decision making
   - 5: Interesting but not actionable
   - 3: Just FYI
   - 1: Useless information

3. NOVELTY: Is this new information?
   - 10: Brand new, user definitely doesn't know
   - 7: Some new info
   - 5: Mix of new and known
   - 3: Mostly redundant
   - 1: User already knows this

Thresholds:
- Relevance must be >= ${thresholds.relevance}
- Actionability must be >= ${thresholds.actionability}
- Novelty must be >= ${thresholds.novelty}

Return JSON:
{
  "shouldShow": boolean,
  "scores": {
    "relevance": 1-10,
    "actionability": 1-10,
    "novelty": 1-10
  },
  "reasoning": "why",
  "suggestedResponse": "cleaned up version if shouldShow=true, or null"
}`;

  const recentContext = recentMessages.slice(0, 10).map(msg =>
    `[${msg.user_name}]: ${msg.data}`
  ).join('\n');

  try {
    const response = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Original query: "${originalQuery}"

Recent conversation:
${recentContext}

Execution output to evaluate:
${executionOutput}

Should this be shown to the user?`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const evaluation = JSON.parse(response.choices[0]?.message?.content);

    console.log(`   Decision: ${evaluation.shouldShow ? '✅ SHOW' : '⏭️ FILTER OUT'}`);
    console.log(`   Scores:`, evaluation.scores);
    console.log(`   Reasoning: ${evaluation.reasoning}`);

    return evaluation;

  } catch (error) {
    console.error(`❌ Output relevance evaluation failed:`, error);
    // Default to showing if evaluation fails
    return {
      shouldShow: true,
      scores: { relevance: 7, actionability: 7, novelty: 7 },
      reasoning: 'Evaluation failed, defaulting to show',
      suggestedResponse: executionOutput
    };
  }
}

/**
 * Evaluate discovery findings (special case of output filtering)
 *
 * @param {Object} groqClient - Groq client
 * @param {Object} config - Configuration
 * @param {Array} config.discoveries - Array of discovery findings
 * @param {Array} config.recentMessages - Recent conversation
 * @param {Object} config.thresholds - Discovery-specific thresholds
 * @returns {Promise<Array>} Filtered discoveries that should be shown
 */
export async function filterDiscoveries(groqClient, config) {
  const {
    discoveries,
    recentMessages = [],
    thresholds = {
      importance: 7,
      actionable: 6,
      novelty: 5
    }
  } = config;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 INTERACTION AGENT: Filtering ${discoveries.length} discoveries`);
  console.log(`${'='.repeat(80)}`);

  const systemPrompt = `You are the Interaction Agent filtering background discovery findings.

Discovery mode found these insights from the conversation. Your job: decide which are worth showing.

Evaluate each discovery (1-10 scale):

1. IMPORTANCE: How important is this finding?
   - 10: Critical information user needs to know
   - 7: Quite useful
   - 5: Mildly interesting
   - 3: Not very important
   - 1: Trivial

2. ACTIONABILITY: Does this require action?
   - 10: Immediate action needed
   - 7: User should probably do something
   - 5: Optional action
   - 3: Just FYI
   - 1: No action needed

3. NOVELTY: Is this new information for the user?
   - 10: Definitely new
   - 7: Probably new
   - 5: Maybe new
   - 3: Probably already knows
   - 1: Definitely already knows

Thresholds (must meet ALL):
- Importance >= ${thresholds.importance}
- Actionable >= ${thresholds.actionable}
- Novelty >= ${thresholds.novelty}

For each discovery, return:
{
  "id": "discovery id",
  "shouldShow": boolean,
  "scores": {
    "importance": 1-10,
    "actionability": 1-10,
    "novelty": 1-10
  },
  "reasoning": "why show or filter out",
  "priority": "high|medium|low" (if shouldShow=true)
}

Return JSON array of evaluations.`;

  const recentContext = recentMessages.slice(0, 20).map(msg =>
    `[${msg.user_name}]: ${msg.data}`
  ).join('\n');

  const discoveriesText = discoveries.map((d, i) =>
    `Discovery ${i + 1} [${d.id}]: ${d.finding}`
  ).join('\n\n');

  try {
    const response = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Recent conversation:
${recentContext}

Discoveries to evaluate:
${discoveriesText}

Which discoveries should be shown to the user?`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const evaluationsResponse = JSON.parse(response.choices[0]?.message?.content);
    const evaluations = evaluationsResponse.evaluations || [];

    // Filter and sort discoveries
    const filtered = discoveries
      .map((discovery, idx) => ({
        ...discovery,
        evaluation: evaluations[idx] || null
      }))
      .filter(d => d.evaluation?.shouldShow)
      .sort((a, b) => {
        // Sort by priority: high > medium > low
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return (priorityMap[b.evaluation.priority] || 0) - (priorityMap[a.evaluation.priority] || 0);
      });

    console.log(`   Filtered: ${filtered.length}/${discoveries.length} discoveries will be shown`);
    filtered.forEach(d => {
      console.log(`   ✅ [${d.evaluation.priority}] ${d.finding.substring(0, 60)}...`);
    });

    return filtered;

  } catch (error) {
    console.error(`❌ Discovery filtering failed:`, error);
    // Default to showing all if filtering fails
    return discoveries;
  }
}

/**
 * Apply personality layer to response
 * (After filtering, if we decide to show it, apply personality)
 *
 * @param {Object} groqClient - Groq client
 * @param {Object} config - Configuration
 * @param {string} config.rawResponse - Raw response from execution
 * @param {Object} config.personality - Personality config
 * @param {Object} config.context - Context for personalization
 * @returns {Promise<string>} Personalized response
 */
export async function applyPersonality(groqClient, config) {
  const {
    rawResponse,
    personality = {
      tone: 'sharp, witty, direct',
      style: 'conversational',
      principle: 'don\'t act like sycophantic chatbots'
    },
    context = {}
  } = config;

  const systemPrompt = `You are the Interaction Agent - the user-facing personality of the AI assistant.

Your personality:
- Tone: ${personality.tone}
- Style: ${personality.style}
- Principle: ${personality.principle}

Take this raw execution output and present it to the user with personality.

Guidelines:
- Be conversational, not robotic
- Cut unnecessary verbosity
- Use natural language
- Show confidence but not arrogance
- NO corporate speak or formulaic responses
- NO "I hope this helps" or "Let me know if..."
- Just deliver the information directly

Raw output may be technical or verbose. Clean it up and make it feel natural.`;

  try {
    const response = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Raw response to personalize:\n\n${rawResponse}`
        }
      ],
      temperature: 0.7 // Higher temp for personality
    });

    const personalizedResponse = response.choices[0]?.message?.content;
    console.log(`✨ Applied personality layer`);

    return personalizedResponse;

  } catch (error) {
    console.error(`❌ Personality application failed:`, error);
    // Return raw response if personality fails
    return rawResponse;
  }
}

/**
 * Orchestrate Interaction Agent workflow
 * Full pipeline: evaluate → execute → filter → personalize
 *
 * @param {Object} groqClient - Groq client
 * @param {Object} config - Full configuration
 * @returns {Promise<Object>} Final response or null (if filtered out)
 */
export async function orchestrateInteraction(groqClient, config) {
  const {
    userMessage,
    recentMessages,
    executionFunction, // Function that does the actual work
    filteringConfig,
    personalityConfig
  } = config;

  console.log(`\n${'█'.repeat(80)}`);
  console.log(`🎭 INTERACTION AGENT ORCHESTRATION`);
  console.log(`${'█'.repeat(80)}\n`);

  // Step 1: Should we respond at all?
  const responseDecision = await evaluateResponseNecessity(groqClient, {
    userMessage,
    recentMessages
  });

  if (!responseDecision.shouldRespond) {
    console.log(`⏭️ Interaction Agent decided to WAIT (stay silent)`);
    return null; // Invoke "wait" - don't respond
  }

  // Step 2: Execute (via Execution Agent)
  console.log(`\n🔧 Passing to Execution Agent...`);
  const executionOutput = await executionFunction();

  // Step 3: Filter output
  const filterDecision = await evaluateOutputRelevance(groqClient, {
    executionOutput: executionOutput.response || executionOutput,
    originalQuery: userMessage,
    recentMessages,
    thresholds: filteringConfig?.thresholds
  });

  if (!filterDecision.shouldShow) {
    console.log(`⏭️ Interaction Agent filtered out execution output`);
    return null; // Don't show to user
  }

  // Step 4: Apply personality
  const finalResponse = await applyPersonality(groqClient, {
    rawResponse: filterDecision.suggestedResponse || executionOutput.response || executionOutput,
    personality: personalityConfig,
    context: {}
  });

  console.log(`\n✅ INTERACTION AGENT: Final response ready`);
  return {
    response: finalResponse,
    filtered: true,
    scores: filterDecision.scores
  };
}

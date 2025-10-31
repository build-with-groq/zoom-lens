/**
 * Salesforce Focus/Goal Management
 * Allows users to set a persistent context/goal that guides all Salesforce AI actions
 * 
 * Example: "I'm working on the Bob Jones deal" -> AI will prioritize all actions related to that lead/contact
 */

// In-memory storage for Salesforce focus goals (per user session)
const salesforceFocusGoals = new Map();

/**
 * Set a focus goal for Salesforce operations
 * @param {string} userId - User identifier (default: 'default')
 * @param {Object} focusGoal - Focus goal configuration
 * @param {string} focusGoal.description - Human-readable description (e.g., "Working on Bob Jones deal")
 * @param {string} [focusGoal.recordId] - Specific Salesforce record ID to focus on
 * @param {string} [focusGoal.recordType] - Type of record (Lead, Contact, Account, Opportunity, etc.)
 * @param {string} [focusGoal.name] - Name of the person/company to focus on
 * @param {Object} [focusGoal.context] - Additional context for the focus
 */
export function setSalesforceFocus(userId = 'default', focusGoal) {
  if (!focusGoal || !focusGoal.description) {
    console.error('❌ Cannot set focus goal: description is required');
    return { success: false, error: 'Description is required' };
  }

  const goal = {
    description: focusGoal.description,
    recordId: focusGoal.recordId || null,
    recordType: focusGoal.recordType || null,
    name: focusGoal.name || null,
    context: focusGoal.context || {},
    timestamp: Date.now(),
    active: true
  };

  salesforceFocusGoals.set(userId, goal);
  
  console.log(`🎯 Salesforce focus set for ${userId}:`, {
    description: goal.description,
    recordId: goal.recordId || 'N/A',
    recordType: goal.recordType || 'N/A',
    name: goal.name || 'N/A'
  });

  return { success: true, goal };
}

/**
 * Get the current focus goal for a user
 * @param {string} userId - User identifier
 * @returns {Object|null} - Current focus goal or null if none set
 */
export function getSalesforceFocus(userId = 'default') {
  const goal = salesforceFocusGoals.get(userId);
  
  if (!goal || !goal.active) {
    return null;
  }

  return goal;
}

/**
 * Clear the focus goal for a user
 * @param {string} userId - User identifier
 */
export function clearSalesforceFocus(userId = 'default') {
  const goal = salesforceFocusGoals.get(userId);
  
  if (goal) {
    goal.active = false;
    console.log(`🎯 Salesforce focus cleared for ${userId}`);
  }
  
  salesforceFocusGoals.delete(userId);
  return { success: true };
}

/**
 * Generate a system prompt addition for the focus goal
 * This gets injected into the AI's system prompt to guide its actions
 * @param {Object} focusGoal - The focus goal object
 * @returns {string} - System prompt addition
 */
export function getFocusGoalPrompt(focusGoal) {
  if (!focusGoal || !focusGoal.active) {
    return '';
  }

  let prompt = `\n\n🎯 **CURRENT SALESFORCE FOCUS/GOAL**: ${focusGoal.description}`;

  if (focusGoal.recordId) {
    prompt += `\n   - Primary Record ID: ${focusGoal.recordId}`;
  }

  if (focusGoal.recordType) {
    prompt += `\n   - Record Type: ${focusGoal.recordType}`;
  }

  if (focusGoal.name) {
    prompt += `\n   - Focus Name: ${focusGoal.name}`;
  }

  prompt += `\n\n**IMPORTANT**: When performing Salesforce operations, PRIORITIZE actions related to this focus. If the user's request is ambiguous or could relate to this focus, assume it does. For example:
- "Add a note" -> Add note to ${focusGoal.name || 'the focus record'}
- "Update status" -> Update ${focusGoal.name || 'the focus record'}'s status
- "Get latest info" -> Get info about ${focusGoal.name || 'the focus record'}
- "Follow up" -> Create task for ${focusGoal.name || 'the focus record'}

When completing actions, remind the user of the current focus context in your response.`;

  return prompt;
}

/**
 * Parse a natural language focus goal into structured data
 * Example: "I'm working on the Bob Jones deal" -> { name: "Bob Jones", recordType: "Lead/Contact" }
 * @param {string} naturalLanguageGoal - User's focus goal in natural language
 * @returns {Object} - Structured focus goal
 */
export function parseFocusGoal(naturalLanguageGoal) {
  const goal = {
    description: naturalLanguageGoal.trim(),
    recordId: null,
    recordType: null,
    name: null,
    context: {}
  };

  // Extract Salesforce ID if present (15 or 18 character IDs)
  const idMatch = naturalLanguageGoal.match(/\b([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})\b/);
  if (idMatch) {
    goal.recordId = idMatch[1];
    
    // Detect record type from ID prefix
    const prefix = goal.recordId.substring(0, 3);
    const recordTypes = {
      '00Q': 'Lead',
      '003': 'Contact',
      '001': 'Account',
      '006': 'Opportunity',
      '00T': 'Task',
      '002': 'Note'
    };
    goal.recordType = recordTypes[prefix] || 'Unknown';
  }

  // Extract name patterns (e.g., "Bob Jones", "Acme Corp")
  const namePatterns = [
    /(?:working on|focusing on|deal with|call with|meeting with)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:contact|lead|account|person|company)\s+(?:named\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)/ // Fallback: any capitalized name
  ];

  for (const pattern of namePatterns) {
    const match = naturalLanguageGoal.match(pattern);
    if (match && match[1]) {
      goal.name = match[1].trim();
      break;
    }
  }

  // Detect record type from keywords if not already detected
  if (!goal.recordType) {
    const typeKeywords = {
      lead: ['lead', 'prospect'],
      contact: ['contact', 'person', 'individual'],
      account: ['account', 'company', 'organization'],
      opportunity: ['opportunity', 'deal', 'pipeline'],
      task: ['task', 'follow-up', 'todo']
    };

    const lowerGoal = naturalLanguageGoal.toLowerCase();
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => lowerGoal.includes(keyword))) {
        goal.recordType = type.charAt(0).toUpperCase() + type.slice(1);
        break;
      }
    }
  }

  return goal;
}

/**
 * Auto-suggest focus goals based on recent Salesforce activity
 * (This would analyze recent transcripts and suggest relevant focus goals)
 * @param {Array} recentTranscripts - Recent conversation transcripts
 * @returns {Array} - Array of suggested focus goals
 */
export function suggestFocusGoals(recentTranscripts) {
  const suggestions = [];
  
  // Extract names and companies mentioned in recent transcripts
  const mentionedNames = new Set();
  const mentionedCompanies = new Set();
  
  recentTranscripts.slice(0, 50).forEach(transcript => {
    if (!transcript.data) return;
    
    // Look for capitalized names (2 words)
    const nameMatches = transcript.data.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
    if (nameMatches) {
      nameMatches.forEach(name => mentionedNames.add(name));
    }
    
    // Look for company indicators
    const companyMatches = transcript.data.match(/\b[A-Z][a-z]+\s+(?:Corp|Inc|LLC|Ltd|Company|Industries)\b/g);
    if (companyMatches) {
      companyMatches.forEach(company => mentionedCompanies.add(company));
    }
  });
  
  // Generate suggestions
  mentionedNames.forEach(name => {
    suggestions.push({
      description: `Working on ${name}`,
      name: name,
      recordType: 'Contact',
      score: 0.8
    });
  });
  
  mentionedCompanies.forEach(company => {
    suggestions.push({
      description: `Focusing on ${company} account`,
      name: company,
      recordType: 'Account',
      score: 0.7
    });
  });
  
  // Sort by score and return top 5
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}


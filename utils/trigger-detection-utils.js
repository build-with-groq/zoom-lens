/**
 * Trigger Detection Utilities
 * Reusable trigger detection logic for multiple agents
 */

/**
 * Creates a configurable trigger detector
 * @param {Object} config - Configuration object
 * @param {string[]} config.keywords - Keywords to detect (e.g., ['zoom'])
 * @param {string[]} config.greetings - Greetings that trigger (e.g., ['hey', 'hi', 'hello'])
 * @param {number} config.maxWordGap - Max words allowed between greeting and keyword
 * @param {Object[]} config.corrections - Text corrections to apply
 * @returns {Function} Trigger detector function
 */
export function createTriggerDetector(config) {
  const {
    keywords = ['zoom'],
    greetings = ['hey', 'hi', 'hello', 'yo', 'sup', "what's up", 'greetings'],
    maxWordGap = 6,
    corrections = []
  } = config;

  return function(text) {
    // Apply corrections
    const normalized = corrections.length > 0
      ? applyCorrections(text, corrections)
      : text;

    // Normalize for detection
    const canonical = normalized
      .toLowerCase()
      .replace(/[.,!?;:]+/g, ' ') // ignore punctuation between/around words
      .replace(/\s+/g, ' ')
      .trim();

    // Build regex patterns for all greeting+keyword combinations
    const patterns = [];

    for (const greeting of greetings) {
      for (const keyword of keywords) {
        // Escape special regex characters
        const escapedGreeting = greeting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Pattern for greeting then keyword (with optional words in between)
        const greetingThenKeyword = new RegExp(
          `\\b${escapedGreeting}\\b(?:\\s+\\S+){0,${maxWordGap}}\\s+\\b${escapedKeyword}\\b`,
          'i'
        );

        // Pattern for keyword then greeting (with optional words in between)
        const keywordThenGreeting = new RegExp(
          `\\b${escapedKeyword}\\b(?:\\s+\\S+){0,${maxWordGap}}\\s+\\b${escapedGreeting}\\b`,
          'i'
        );

        patterns.push({ greetingThenKeyword, keywordThenGreeting });
      }
    }

    // Test all patterns
    const hasGreetingTrigger = patterns.some(p =>
      p.greetingThenKeyword.test(canonical) || p.keywordThenGreeting.test(canonical)
    );

    // Check for standalone keywords at start or concatenated forms
    const hasStandaloneTrigger = keywords.some(keyword => {
      const keywordPattern = new RegExp(`^${keyword}\\b`, 'i');
      const concatenatedPattern = new RegExp(
        `\\b${greetings.map(g => g.replace(/\s+/g, '')).join('|')}${keyword}\\b`,
        'i'
      );
      return keywordPattern.test(canonical) || concatenatedPattern.test(canonical);
    });

    return hasGreetingTrigger || hasStandaloneTrigger;
  };
}

/**
 * Apply text corrections to normalize common misspellings
 * @param {string} text - Original text
 * @param {Object[]} corrections - Array of {from: RegExp, to: string} corrections
 * @returns {string} Corrected text
 */
export function applyCorrections(text, corrections) {
  if (!text) return text;

  let correctedText = text;

  corrections.forEach(correction => {
    correctedText = correctedText.replace(correction.from, correction.to);
  });

  return correctedText;
}

/**
 * Standard Zoom trigger corrections
 */
export const ZOOM_CORRECTIONS = [
  // Exact word replacements (case-sensitive for proper nouns)
  { from: /\bzoom\b/g, to: 'Zoom' },         // zoom -> Zoom (standardize)
  { from: /\bZOOM\b/g, to: 'Zoom' },         // ZOOM -> Zoom
  { from: /\bzooom\b/gi, to: 'Zoom' },       // zooom -> Zoom
  { from: /\bzom\b/gi, to: 'Zoom' },         // zom -> Zoom

  // Contextual corrections for phrases
  { from: /hey\s+zoom/gi, to: 'Hey Zoom' },    // "hey zoom" -> "Hey Zoom"
  { from: /hi\s+zoom/gi, to: 'Hey Zoom' },     // "hi zoom" -> "Hey Zoom"
  { from: /hello\s+zoom/gi, to: 'Hey Zoom' },  // "hello zoom" -> "Hey Zoom"

  // Handle cases where "zoom" appears without "hey"
  { from: /^\s*zoom\s+/gi, to: 'Zoom ' },      // "zoom something" -> "Zoom something"

  // Add Hugging Face corrections
  { from: /\bhugging\s+clothes?\b/gi, to: 'Hugging Face' },
  { from: /\bhuging\s+face\b/gi, to: 'Hugging Face' },
  { from: /\bhuggingface\b/gi, to: 'Hugging Face' },
  { from: /\bhugging\s+face\b/gi, to: 'Hugging Face' },
];

/**
 * Apply Zoom-specific spelling corrections
 * @param {string} text - Text to correct
 * @returns {string} Corrected text
 */
export function correctZoomSpelling(text) {
  return applyCorrections(text, ZOOM_CORRECTIONS);
}

/**
 * Detect "Hey Zoom" trigger using simple detection
 * @param {string} text - Text to analyze
 * @returns {boolean} True if trigger detected
 */
export function detectZoomTrigger(text) {
  const detector = createTriggerDetector({
    keywords: ['zoom'],
    greetings: ['hey', 'hi', 'hello', 'yo', 'sup', "what's up", 'greetings'],
    maxWordGap: 6,
    corrections: ZOOM_CORRECTIONS
  });

  const hasTrigger = detector(text);

  console.log(`🎤 Trigger detection for: "${text}" -> ${hasTrigger ? '✅ DETECTED' : '❌ NOT DETECTED'}`);

  return hasTrigger;
}

/**
 * Create a custom trigger detector with specific keywords and greetings
 * @param {string[]} keywords - Keywords to detect
 * @param {string[]} greetings - Greetings that trigger
 * @param {Object[]} corrections - Optional corrections
 * @returns {Function} Trigger detector function
 */
export function createCustomTrigger(keywords, greetings, corrections = []) {
  return createTriggerDetector({
    keywords,
    greetings,
    maxWordGap: 6,
    corrections
  });
}

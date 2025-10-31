/**
 * Test script for feedback loop prevention
 *
 * Tests that AI-generated messages are correctly identified and blocked
 * Usage: deno run test/test-feedback-prevention.js
 */

import { isAIGeneratedMessage, AI_IDENTIFIERS } from "../config.js";

console.log("🧪 Testing Feedback Loop Prevention\n");

// Test cases: [user_id, user_name, shouldBeBlocked, description]
const testCases = [
  // AI messages that should be blocked
  ["zoom-ai", "Zoom AI Assistant", true, "Main AI assistant"],
  ["discovery-ai", "Discovery", true, "Discovery mode"],
  ["zoom-ai-router", "Router Decision", true, "Router decisions"],
  ["system", "System", true, "System messages"],
  ["zoom-ai", "Unknown Name", true, "AI user_id with unknown name"],
  ["unknown-id", "Zoom AI Assistant", true, "Unknown user_id with AI name"],

  // User messages that should NOT be blocked
  ["user-123", "John Doe", false, "Regular user"],
  ["manual-user", "You", false, "Manual user"],
  ["zoom-meeting-123", "Jane Smith", false, "Zoom meeting participant"],
  [undefined, "Anonymous", false, "Undefined user_id"],
  ["", "", false, "Empty strings"],
];

let passed = 0;
let failed = 0;

console.log("📋 Current AI Identifiers Configuration:");
console.log("   user_ids:", AI_IDENTIFIERS.user_ids);
console.log("   user_names:", AI_IDENTIFIERS.user_names);
console.log("");

testCases.forEach(([user_id, user_name, expected, description], index) => {
  const result = isAIGeneratedMessage(user_id, user_name);
  const status = result === expected ? "✅ PASS" : "❌ FAIL";

  if (result === expected) {
    passed++;
  } else {
    failed++;
    console.log(`${status} Test ${index + 1}: ${description}`);
    console.log(`   user_id: "${user_id}", user_name: "${user_name}"`);
    console.log(`   Expected: ${expected}, Got: ${result}\n`);
  }
});

console.log("\n" + "=".repeat(60));
console.log(`📊 Results: ${passed}/${testCases.length} passed, ${failed} failed`);

if (failed === 0) {
  console.log("✅ All tests passed! Feedback loop prevention is working correctly.");
} else {
  console.log("❌ Some tests failed. Please review the AI_IDENTIFIERS configuration.");
  Deno.exit(1);
}

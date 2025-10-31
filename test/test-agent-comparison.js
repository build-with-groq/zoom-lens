#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Agent Comparison Test Script
 *
 * Quick test to compare agent-1 vs agent-2 without modifying main.js
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read test/test-agent-comparison.js
 *
 * Or make it executable:
 *   chmod +x test/test-agent-comparison.js
 *   ./test/test-agent-comparison.js
 */

import { testBothAgents, switchAgent, getAgentInfo, listAvailableAgents } from '../src/agent-router.js';

console.log(`\n${'█'.repeat(80)}`);
console.log(`🧪 AGENT COMPARISON TEST SUITE`);
console.log(`${'█'.repeat(80)}\n`);

// Show available agents
console.log(`📋 Available agents: ${listAvailableAgents().join(', ')}\n`);

// Test cases
const testCases = [
  {
    name: 'Acknowledgment (should differ)',
    transcript: 'ok thanks',
    expectation: 'Agent-1 should respond, Agent-2 should wait'
  },
  {
    name: 'Simple greeting',
    transcript: 'hey zoom',
    expectation: 'Both should respond'
  },
  {
    name: 'Direct question',
    transcript: 'hey zoom, what\'s the weather in SF?',
    expectation: 'Both should respond with weather'
  },
  {
    name: 'Casual conversation',
    transcript: 'yeah that sounds good',
    expectation: 'Agent-1 responds, Agent-2 might wait'
  },
  {
    name: 'Multiple questions',
    transcript: 'hey zoom, what\'s the weather and search for Salesforce leads',
    expectation: 'Both should respond with multiple tools'
  }
];

// Run tests
let testNumber = 0;
for (const testCase of testCases) {
  testNumber++;
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`TEST ${testNumber}/${testCases.length}: ${testCase.name}`);
  console.log(`Input: "${testCase.transcript}"`);
  console.log(`Expected: ${testCase.expectation}`);
  console.log(`${'━'.repeat(80)}`);

  try {
    const results = await testBothAgents(
      testCase.transcript,
      'Test User',
      []  // Empty chat history
    );

    // Print results
    console.log(`\n📊 RESULTS:\n`);

    // Agent-1
    if (results['agent-1']?.success) {
      console.log(`✅ Agent-1 (Always-On):`);
      console.log(`   Detected: ${results['agent-1'].detected}`);
      console.log(`   Response: ${results['agent-1'].response?.substring(0, 150)}...`);
      console.log(`   Tools used: ${results['agent-1'].tools?.length || 0}`);
    } else {
      console.log(`❌ Agent-1 Error: ${results['agent-1']?.error}`);
    }

    console.log('');

    // Agent-2
    if (results['agent-2']?.success) {
      console.log(`✅ Agent-2 (Thoughtful):`);
      console.log(`   Detected: ${results['agent-2'].detected}`);
      console.log(`   Waited: ${results['agent-2'].waited || false}`);
      if (results['agent-2'].waited) {
        console.log(`   Response: [SILENT - invoked wait tool]`);
      } else {
        console.log(`   Response: ${results['agent-2'].response?.substring(0, 150)}...`);
      }
      console.log(`   Tools used: ${results['agent-2'].tools?.length || 0}`);
    } else {
      console.log(`⚠️ Agent-2: ${results['agent-2']?.error || 'Not yet implemented'}`);
    }

    // Compare
    console.log(`\n🔍 Comparison:`);
    const agent1Responded = results['agent-1']?.success && results['agent-1']?.detected;
    const agent2Responded = results['agent-2']?.success && !results['agent-2']?.waited;

    if (agent1Responded && !agent2Responded) {
      console.log(`   ✨ Agent-2 was MORE SELECTIVE (stayed silent)`);
    } else if (!agent1Responded && agent2Responded) {
      console.log(`   ✨ Agent-1 was MORE SELECTIVE (stayed silent)`);
    } else if (agent1Responded && agent2Responded) {
      console.log(`   ↔️ Both agents responded`);
    } else {
      console.log(`   ⏭️ Neither agent responded`);
    }

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(error.stack);
  }

  // Wait a bit between tests to avoid rate limits
  console.log(`\n⏳ Waiting 2 seconds before next test...`);
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Summary
console.log(`\n${'█'.repeat(80)}`);
console.log(`📋 TEST SUMMARY`);
console.log(`${'█'.repeat(80)}`);
console.log(`\nCompleted ${testNumber} test cases`);
console.log(`\nKey observations to look for:`);
console.log(`  • Agent-2 should stay silent on "ok thanks"`);
console.log(`  • Agent-2 should respond to direct questions`);
console.log(`  • Agent-2 responses should be more concise`);
console.log(`  • Both should trigger on "hey zoom"`);
console.log(`\n${'█'.repeat(80)}\n`);

// Instructions
console.log(`💡 TIP: To test individual agents:`);
console.log(`\n   # Test agent-1 only`);
console.log(`   export ACTIVE_AGENT=agent-1`);
console.log(`   deno task serve`);
console.log(`\n   # Test agent-2 only`);
console.log(`   export ACTIVE_AGENT=agent-2`);
console.log(`   deno task serve`);
console.log(`\n   # Check which agent is active`);
console.log(`   curl localhost:9995/api/agent-info\n`);

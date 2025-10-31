/**
 * Test script for bearer token authentication
 * 
 * Usage:
 * deno run --allow-net --allow-env test/test-bearer-token.js
 * 
 * This tests the new /sse/message endpoint with bearer token authentication
 */

import "jsr:@std/dotenv/load"; // needed for deno run

const SERVER_URL = Deno.env.get('TEST_SERVER_URL') || 'http://localhost:8000';
const SALESFORCE_TOKEN = Deno.env.get('TEST_SALESFORCE_TOKEN') || 'YOUR_TEST_TOKEN';
const SALESFORCE_INSTANCE_URL = Deno.env.get('TEST_SALESFORCE_INSTANCE_URL') || 'https://yourinstance.salesforce.com';

console.log('🧪 Testing Bearer Token Authentication\n');
console.log(`Server: ${SERVER_URL}`);
console.log(`Instance: ${SALESFORCE_INSTANCE_URL}`);
console.log(`Token: ${SALESFORCE_TOKEN.substring(0, 20)}...\n`);

// Test 1: Search for leads
console.log('Test 1: Search for leads with company filter');
console.log('─'.repeat(80));

try {
  const response = await fetch(`${SERVER_URL}/sse/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SALESFORCE_TOKEN}`,
      'X-Salesforce-Instance-Url': SALESFORCE_INSTANCE_URL,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'sf_search_leads',
        arguments: {
          company: 'Acme'
        }
      }
    })
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  
  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('✅ Test 1 PASSED');
  } else {
    console.log('❌ Test 1 FAILED:', result.error);
  }
} catch (error) {
  console.error('❌ Test 1 ERROR:', error.message);
}

console.log('\n' + '─'.repeat(80) + '\n');

// Test 2: Create a lead
console.log('Test 2: Create a new lead');
console.log('─'.repeat(80));

try {
  const response = await fetch(`${SERVER_URL}/sse/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SALESFORCE_TOKEN}`,
      'X-Salesforce-Instance-Url': SALESFORCE_INSTANCE_URL,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'sf_create_lead',
        arguments: {
          first_name: 'Test',
          last_name: 'User',
          company: 'Test Company'
        }
      }
    })
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  
  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('✅ Test 2 PASSED');
  } else {
    console.log('❌ Test 2 FAILED:', result.error);
  }
} catch (error) {
  console.error('❌ Test 2 ERROR:', error.message);
}

console.log('\n' + '─'.repeat(80) + '\n');

// Test 3: Missing authorization header (should fail)
console.log('Test 3: Missing authorization header (should fail with 401)');
console.log('─'.repeat(80));

try {
  const response = await fetch(`${SERVER_URL}/sse/message`, {
    method: 'POST',
    headers: {
      'X-Salesforce-Instance-Url': SALESFORCE_INSTANCE_URL,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tools/call',
      params: {
        name: 'sf_search_leads',
        arguments: {
          company: 'Acme'
        }
      }
    })
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  
  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));
  
  if (response.status === 401) {
    console.log('✅ Test 3 PASSED (correctly rejected unauthorized request)');
  } else {
    console.log('❌ Test 3 FAILED (should have returned 401)');
  }
} catch (error) {
  console.error('❌ Test 3 ERROR:', error.message);
}

console.log('\n' + '─'.repeat(80) + '\n');

console.log('🧪 Testing Complete!');


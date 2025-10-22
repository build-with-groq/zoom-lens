import "jsr:@std/dotenv/load"; // needed for deno run; not req for smallweb or valtown

/**
 * Test script to verify Groq API calls for Salesforce MCP server
 * This script replicates the curl command that never fails
 */

async function testGroqAPI() {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  
  if (!apiKey) {
    console.error("❌ Error: GROQ_API_KEY environment variable is not set");
    console.error("Please set it in your .env file or environment");
    Deno.exit(1);
  }

  const requestBody = {
    messages: [
      {
        role: "user",
        content: '{\n  "access_token": "12345",\n  "instance_url": "https://orgfarm-a4d4fb7858-dev-ed.develop.my.salesforce.com",\n  "state": "login_12345"\n}\n\nget the last 10 leads from salesforce'
      },
      {
        role: "assistant",
        tool_calls: [
          {
            id: "fc_5666343e-13f7-4584-9548-7c6d43764fdc",
            type: "function",
            function: {
              name: "salesforce__sf_run_soql_query",
              arguments: '{"soql":"SELECT Id, FirstName, LastName, Company, Email, Phone, CreatedDate FROM Lead ORDER BY CreatedDate DESC LIMIT 10"}'
            },
            index: 2
          }
        ]
      },
      {
        role: "tool",
        tool_call_id: "fc_3e893eeb-2e89-47bf-9ec9-7cdecfb11375",
        name: "salesforce__sf_set_credentials",
        content: ""
      }
    ],
    model: "openai/gpt-oss-120b",
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    stream: false,
    reasoning_effort: "medium",
    stop: null,
    tools: [
      {
        type: "mcp",
        server_label: "salesforce",
        server_url: "https://salesforce-mcp-wrapper.yawnxyz.workers.dev/mcp",
        headers: {}
      }
    ]
  };

  console.log("🚀 Testing Groq API call...");
  console.log("📝 Request URL: https://api.groq.com/openai/v1/chat/completions");
  console.log("📦 Request body:", JSON.stringify(requestBody, null, 2));
  console.log("\n⏳ Sending request...\n");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log("📋 Response headers:");
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    console.log("");

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error response body:", errorText);
      Deno.exit(1);
    }

    // Handle non-streaming response
    const responseData = await response.json();
    console.log("📥 Response JSON:");
    console.log("─".repeat(60));
    console.log(JSON.stringify(responseData, null, 2));
    console.log("─".repeat(60));

    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error making request:", error);
    console.error("Error details:", error.message);
    if (error.cause) {
      console.error("Cause:", error.cause);
    }
    Deno.exit(1);
  }
}

// Run the test
if (import.meta.main) {
  testGroqAPI();
}


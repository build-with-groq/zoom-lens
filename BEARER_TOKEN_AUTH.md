# Bearer Token Authentication Implementation

## Overview

This implementation adds support for Salesforce bearer token authentication via HTTP headers, allowing API clients to pass credentials directly in requests instead of relying on server-side credential storage. This is particularly useful for serverless deployments and external integrations.

## What Changed

### 1. Enhanced `processToolAuth` Function (`auth-utils.js`)

**Added**: Support for bearer token passthrough from HTTP request headers

```javascript
export function processToolAuth(toolConfig, userId = 'default', requestHeaders = null)
```

**New Functionality**:
- Checks for `Authorization: Bearer TOKEN` header in incoming requests
- Checks for `X-Salesforce-Instance-Url` header
- Extracts and uses these credentials for Salesforce MCP authentication
- Falls back to stored credentials if no bearer token provided
- Maintains backward compatibility with existing flows

**Logic**:
1. If `requestHeaders` are provided, check for bearer token
2. If bearer token found, extract and use it for authentication
3. If no bearer token, fall back to stored credentials (existing behavior)
4. If no credentials at all, return error

### 2. Updated `performGroqInference` Function (`ai-inference.js`)

**Added**: `requestHeaders` parameter to pass incoming request headers

```javascript
export async function performGroqInference(
  transcript, 
  userName, 
  context = 'general', 
  chatHistory = [], 
  skipTriggerDetection = false, 
  progressCallback = null, 
  requestHeaders = null  // NEW
)
```

**Modified Salesforce Authentication Logic**:
- For Salesforce tools, now checks for bearer token in request headers first
- If bearer token found, passes it to the MCP server
- If no bearer token, uses existing `sf_set_credentials` flow
- Logs which authentication method is being used

### 3. Updated API Endpoints (`main.js`)

**Modified Endpoints to Pass Request Headers**:

1. **`POST /api/trigger-groq`**:
   ```javascript
   const result = await performGroqInference(
     // ... existing params ...
     c.req.raw.headers // Pass request headers
   );
   ```

2. **`POST /api/groq-inference`**:
   ```javascript
   const result = await performGroqInference(
     // ... existing params ...
     c.req.raw.headers // Pass request headers
   );
   ```

**Added New Endpoint**: `POST /sse/message`

This is a dedicated endpoint for MCP tool calls with bearer token authentication.

**Features**:
- Validates bearer token authentication
- Validates instance URL
- Parses MCP request format (`method: "tools/call"`)
- Converts MCP requests to natural language queries
- Processes through `performGroqInference` with bearer token
- Returns structured response

**Request Format**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "sf_search_leads",
    "arguments": {
      "company": "Acme"
    }
  }
}
```

**Required Headers**:
- `Authorization: Bearer YOUR_SALESFORCE_TOKEN`
- `X-Salesforce-Instance-Url: https://yourinstance.salesforce.com`

## Usage Examples

### Example 1: Direct MCP Call with Bearer Token

```bash
curl -X POST https://your-server.com/sse/message \
  -H "Authorization: Bearer YOUR_SALESFORCE_TOKEN" \
  -H "X-Salesforce-Instance-Url: https://yourinstance.salesforce.com" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "sf_search_leads",
      "arguments": {
        "company": "Acme"
      }
    }
  }'
```

### Example 2: Natural Language with Bearer Token

```bash
curl -X POST https://your-server.com/api/trigger-groq \
  -H "Authorization: Bearer YOUR_SALESFORCE_TOKEN" \
  -H "X-Salesforce-Instance-Url: https://yourinstance.salesforce.com" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Hey Groq, search for leads in Acme Corp",
    "user_name": "API Client",
    "context": "api_request"
  }'
```

### Example 3: Existing Flow (No Bearer Token)

```bash
curl -X POST https://your-server.com/api/trigger-groq \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Hey Groq, search for leads in Acme Corp",
    "user_name": "User",
    "salesforce_credentials": {
      "access_token": "...",
      "instance_url": "..."
    }
  }'
```

## Benefits

### 1. **Serverless-Friendly**
- No need to maintain in-memory credential storage
- Each request is self-contained with its own credentials
- Perfect for Deno Deploy and other serverless platforms

### 2. **Security**
- Credentials are not stored on the server
- Each request is authenticated independently
- Reduces risk of credential leakage

### 3. **Flexibility**
- Supports both bearer token and stored credential flows
- API clients can choose their preferred method
- Backward compatible with existing implementations

### 4. **Simplicity**
- No OAuth flow required for API clients
- Direct credential passing in headers
- Easy to test and debug

## Testing

Run the test script to verify bearer token authentication:

```bash
# Set environment variables
export TEST_SALESFORCE_TOKEN="your_token_here"
export TEST_SALESFORCE_INSTANCE_URL="https://yourinstance.salesforce.com"
export TEST_SERVER_URL="http://localhost:8000"

# Run the test
deno run --allow-net --allow-env test-bearer-token.js
```

The test script includes:
1. **Test 1**: Search for leads with company filter
2. **Test 2**: Create a new lead
3. **Test 3**: Verify unauthorized requests are rejected (401)

## Implementation Notes

### Authentication Hierarchy

1. **Bearer Token (Priority 1)**: If `Authorization` and `X-Salesforce-Instance-Url` headers are present
2. **Stored Credentials (Priority 2)**: If no bearer token but credentials stored in memory
3. **Request Body Credentials (Priority 3)**: If `salesforce_credentials` in request body

### Header Handling

The implementation uses Hono's `c.req.raw.headers` to access the native `Headers` object, which provides:
- `.get(name)` method for header retrieval
- Support for both `Authorization` and case-insensitive access

### Logging

Added extensive logging to help debug authentication flow:
- `🔐 Using bearer token from request headers` - Bearer token found and used
- `⚠️ No bearer token in request, will use sf_set_credentials` - Falling back to stored credentials

## Future Enhancements

Potential improvements for future iterations:

1. **Token Refresh**: Automatic refresh of expired bearer tokens
2. **Token Caching**: Short-term caching of validated tokens
3. **Multi-Tenant Support**: Multiple Salesforce orgs per user
4. **Rate Limiting**: Per-token rate limiting for API clients
5. **Audit Logging**: Track bearer token usage for security

## Files Modified

1. `auth-utils.js` - Added bearer token support to `processToolAuth`
2. `ai-inference.js` - Updated `performGroqInference` to accept and use request headers
3. `main.js` - Updated endpoints and added `/sse/message` endpoint
4. `README.md` - Documented bearer token authentication
5. `test-bearer-token.js` - Created test script (new file)
6. `BEARER_TOKEN_AUTH.md` - This documentation (new file)

## Backward Compatibility

✅ **Fully Backward Compatible**

All existing functionality continues to work:
- OAuth flow still works
- Stored credentials still work
- Request body credentials still work
- Frontend credential management still works

Bearer token authentication is an **addition**, not a replacement.


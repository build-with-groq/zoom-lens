# Quick Start: Bearer Token Authentication

## 🚀 Quick Start (30 seconds)

### Get Your Salesforce Token

```bash
# Get your Salesforce access token
sf org display --target-org your-org --json | jq -r '.result.accessToken'

# Or manually from browser console (when logged into Salesforce)
# Open Developer Tools > Console and run:
# copy(window.salesforceAccessToken)
```

### Make Your First Request

```bash
# Set your credentials
export SF_TOKEN="your_access_token_here"
export SF_INSTANCE="https://yourinstance.salesforce.com"
export SERVER_URL="http://localhost:8000"

# Search for leads
curl -X POST $SERVER_URL/sse/message \
  -H "Authorization: Bearer $SF_TOKEN" \
  -H "X-Salesforce-Instance-Url: $SF_INSTANCE" \
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

## 📋 Common Operations

### Search Leads by Company

```bash
curl -X POST $SERVER_URL/sse/message \
  -H "Authorization: Bearer $SF_TOKEN" \
  -H "X-Salesforce-Instance-Url: $SF_INSTANCE" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "sf_search_leads",
      "arguments": {"company": "Acme"}
    }
  }'
```

### Create a Lead

```bash
curl -X POST $SERVER_URL/sse/message \
  -H "Authorization: Bearer $SF_TOKEN" \
  -H "X-Salesforce-Instance-Url: $SF_INSTANCE" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "sf_create_lead",
      "arguments": {
        "first_name": "John",
        "last_name": "Doe",
        "company": "TechCorp"
      }
    }
  }'
```

### Run SOQL Query

```bash
curl -X POST $SERVER_URL/sse/message \
  -H "Authorization: Bearer $SF_TOKEN" \
  -H "X-Salesforce-Instance-Url: $SF_INSTANCE" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "sf_run_soql_query",
      "arguments": {
        "query": "SELECT Id, Name, Company FROM Lead LIMIT 10"
      }
    }
  }'
```

### Natural Language (Alternative)

```bash
curl -X POST $SERVER_URL/api/trigger-groq \
  -H "Authorization: Bearer $SF_TOKEN" \
  -H "X-Salesforce-Instance-Url: $SF_INSTANCE" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Hey Groq, search for leads in Acme Corp",
    "user_name": "API Client"
  }'
```

## 🧪 Testing

```bash
# Clone and setup
cd zoom-lens

# Set test credentials
export TEST_SALESFORCE_TOKEN="your_token"
export TEST_SALESFORCE_INSTANCE_URL="https://yourinstance.salesforce.com"
export TEST_SERVER_URL="http://localhost:8000"

# Run tests
deno run --allow-net --allow-env test-bearer-token.js
```

## 🔑 Available Tools

| Tool Name | Description | Required Args |
|-----------|-------------|---------------|
| `sf_search_leads` | Search leads | `company`, `name`, `status`, `limit` |
| `sf_create_lead` | Create lead | `first_name`, `last_name`, `company` |
| `sf_update_lead` | Update lead | `id`, field values |
| `sf_search_contacts` | Search contacts | `name`, `email`, `phone` |
| `sf_create_contact` | Create contact | `first_name`, `last_name`, `account_id` |
| `sf_search_accounts` | Search accounts | `name`, `industry` |
| `sf_run_soql_query` | Run SOQL | `query` |
| `sf_create_note` | Create note | `parent_id`, `title`, `body` |
| `sf_create_task` | Create task | `subject`, `who_id`, `what_id` |

## 🔒 Security Notes

- Bearer tokens are **not stored** on the server
- Each request is authenticated independently
- Tokens should be kept secure (use environment variables)
- Rotate tokens regularly
- Use HTTPS in production

## ⚠️ Troubleshooting

### 401 Unauthorized
```bash
# Token expired or invalid
# Get a fresh token:
sf org display --target-org your-org --json | jq -r '.result.accessToken'
```

### 400 Bad Request
```bash
# Check instance URL format:
# ✅ https://yourinstance.salesforce.com
# ❌ https://yourinstance.salesforce.com/
# ❌ yourinstance.salesforce.com
```

### 500 Server Error
```bash
# Check server logs
# Verify SALESFORCE_MCP_URL is configured
# Ensure Groq API key is valid
```

## 📚 More Examples

### Python

```python
import requests

url = "http://localhost:8000/sse/message"
headers = {
    "Authorization": f"Bearer {SF_TOKEN}",
    "X-Salesforce-Instance-Url": SF_INSTANCE,
    "Content-Type": "application/json"
}
data = {
    "method": "tools/call",
    "params": {
        "name": "sf_search_leads",
        "arguments": {"company": "Acme"}
    }
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

### JavaScript

```javascript
const response = await fetch('http://localhost:8000/sse/message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SF_TOKEN}`,
    'X-Salesforce-Instance-Url': SF_INSTANCE,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'sf_search_leads',
      arguments: { company: 'Acme' }
    }
  })
});

const result = await response.json();
console.log(result);
```

## 🎯 Production Deployment

```bash
# Deploy to Deno Deploy
deno deploy --project=your-project main.js

# Set environment variables in Deno Deploy dashboard:
# - GROQ_API_KEY
# - SALESFORCE_MCP_URL
# - Other required vars

# Use production URL in requests:
export SERVER_URL="https://your-project.deno.dev"
```

## 💡 Tips

1. **Cache tokens locally** - Tokens are valid for hours, reuse them
2. **Use environment variables** - Never hardcode tokens
3. **Handle errors gracefully** - Check response status codes
4. **Log requests** - Helps with debugging
5. **Use natural language endpoint** - For complex queries

## 🔗 Resources

- [Full Documentation](./BEARER_TOKEN_AUTH.md)
- [README](./README.md)
- [Test Script](./test-bearer-token.js)
- [Salesforce REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Groq Documentation](https://console.groq.com/docs)


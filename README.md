# Zoom Lens V2 - Refactored Architecture

> Modular, extensible AI agent framework with support for multiple agent experiments

## Overview

Zoom Lens V2 is a refactored version of the original Zoom Lens AI-powered meeting assistant. The primary goal of this refactor is to create a modular architecture that allows for easy experimentation with different agent implementations while sharing common utilities and infrastructure.

## Key Improvements

### 1. **Modular Architecture**
- Core utilities extracted into reusable `/utils` directory
- Agent-specific code isolated in `/experiments/agent-{n}` directories
- Clear separation between infrastructure and agent logic

### 2. **Reusable Utilities**
- **Trigger Detection**: Configurable keyword/greeting detection system
- **Deduplication**: Request deduplication with time-window tracking
- **SSE Broadcasting**: Server-sent events for real-time updates
- **Context Strategy**: Smart chat history management
- **Tool Registry**: Framework for managing MCP and built-in tools
- **WebSocket Core**: Generic WebSocket connection management
- **Auth Core**: Multi-strategy authentication handling

### 3. **Experiment-Driven Development**
- Each agent variant lives in its own experiment directory
- Easy to compare different approaches side-by-side
- Agent-1 maintains 100% compatibility with v1 functionality
- Future agents (agent-2, agent-3) can be added without affecting existing ones

## Directory Structure

```
zoom-lens-v2/
├── utils/                              # Shared utility modules
│   ├── trigger-detection-utils.js      # Configurable trigger detection
│   ├── deduplication-utils.js          # Request deduplication
│   ├── sse-broadcast-utils.js          # SSE client management
│   ├── context-strategy-utils.js       # Chat history context management
│   ├── tool-registry-core.js           # Tool registry framework
│   ├── websocket-core-utils.js         # WebSocket helpers
│   └── auth-core-utils.js              # Authentication utilities
│
├── experiments/                        # Agent experiments
│   ├── agent-1/                        # Agent-1: Original Zoom Lens (always-on)
│   │   ├── agent-1-config.js           # Agent configuration
│   │   └── agent-1-inference.js        # AI inference logic
│   └── agent-2/                        # Agent-2: Poke-inspired (thoughtful filtering)
│       ├── agent-2-config.js           # Interaction + Execution agent config
│       ├── README.md                   # Architecture documentation
│       ├── QUICK_START.md              # 5-minute setup guide
│       └── INTEGRATION_EXAMPLE.js      # Usage examples
│
├── main.js                             # Main application entry point
├── config.js                           # Environment configuration
├── auth-utils.js                       # Auth implementation
├── crypto-utils.js                     # Cryptographic utilities
├── styles.js                           # UI styling
├── websocket-utils.js                  # Zoom RTMS WebSocket handlers
├── tool-registry-unified.js            # Tool definitions
├── salesforce-focus.js                 # Salesforce context tracking
├── salesforce-routes.js                # Salesforce OAuth routes
├── frontend/                           # Frontend UI
│   └── index.html                      # Live transcript viewer
├── deno.json                           # Deno configuration
└── README.md                           # This file
```

## Running the Application

```bash
# Set environment variables
export ZOOM_CLIENT_ID="your_zoom_client_id"
export ZOOM_CLIENT_SECRET="your_zoom_client_secret"
export ZOOM_SECRET_TOKEN="your_zoom_secret_token"
export GROQ_API_KEY="your_groq_api_key"

# Run locally
deno run --allow-net --allow-env --allow-read main.js

# Deploy to Deno Deploy
deployctl deploy --project=your-project main.js
```

## Available Agents

### Agent-1: The Always-On Assistant
- **Philosophy**: "Always ready to help"
- **Architecture**: Single agent, direct responses
- **Best For**: Active Q&A sessions, testing, development
- **Characteristics**: Responds to everything, predictable, no filtering

### Agent-2: The Thoughtful Assistant ⭐ NEW
- **Philosophy**: "Better to stay silent than be annoying"
- **Architecture**: Poke-inspired orchestration (Interaction Agent + Execution Agent)
- **Best For**: Background assistance, discovery mode, meeting contexts
- **Characteristics**: Filters outputs, stays silent when appropriate, rate-limited discoveries

**Key Innovation**: Separates eager execution from thoughtful presentation
- **Interaction Agent** acts as gatekeeper, decides what reaches user
- **Execution Agent** can be thorough without being annoying
- Inspired by [Poke's multi-agent architecture](https://shlokkhemani.com/writing/openpoke)

📖 **Learn More**:
- [Agent-2 README](./experiments/agent-2/README.md) - Full architecture explanation
- [Agent-2 Quick Start](./experiments/agent-2/QUICK_START.md) - 5-minute setup
- [Agent Comparison](./AGENT_COMPARISON.md) - Detailed comparison of agent-1 vs agent-2

### Choosing an Agent

| Scenario | Recommended Agent |
|----------|-------------------|
| Active Q&A session | Agent-1 |
| Background meeting assistant | Agent-2 ✅ |
| Discovery mode enabled | Agent-2 ✅ |
| Testing/development | Agent-1 |
| User prefers quiet assistance | Agent-2 ✅ |

## Benefits

- **Experimentation**: Easy to try new approaches
- **Maintainability**: Clear separation of concerns
- **Reusability**: Common utilities shared across agents
- **Scalability**: Add new agents without modifying core infrastructure

See full documentation in README for detailed utility usage examples.

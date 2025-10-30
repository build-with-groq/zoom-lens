# Zoom Lens V2 - Refactored Architecture

> Modular, extensible AI agent framework with support for multiple agent experiments

## Overview

Zoom Lens V2 is an AI-powered meeting assistant that integrates with Zoom RTMS to provide intelligent, context-aware assistance during meetings. Built with a modular architecture, it enables easy experimentation with different agent implementations while sharing common utilities and infrastructure.

## Key Features

**MCP Integration & Tool Use** - The core capability that sets Zoom Lens apart:
- **Model Context Protocol (MCP) Support**: Full integration with MCP servers for connecting to external tools and services
- **Salesforce Integration**: Built-in Salesforce MCP connector with OAuth authentication, supporting 30+ CRM operations (leads, contacts, accounts, notes, SOQL queries)
- **Custom MCP Extensions**: Easy framework to add your own MCP servers - simply register new tools in the unified tool registry
- **Intelligent Tool Routing**: AI-powered router selects appropriate tools and functions based on user intent
- **Multi-Tool Requests**: Handle complex queries requiring multiple tools in parallel
- **Built-in Tools**: Weather, web search (Groq Compound), Hugging Face models, and direct answers

**Modular Architecture**:
- Core utilities organized in reusable `/utils` directory
- Agent-specific code isolated in `/experiments/agent-{n}` directories
- Experiment-driven development - each agent variant lives in its own directory for easy comparison
- **Trigger Detection**: Configurable keyword/greeting detection system
- **Deduplication**: Request deduplication with time-window tracking
- **Context Strategy**: Smart chat history management
- **Tool Registry**: Framework for managing MCP and built-in tools


## Agent Architecture

Zoom Lens V2 uses an AI-powered intelligent routing system that analyzes user queries and automatically selects the appropriate tools and MCP functions. The `intelligentRouter` function uses Groq's LLM models to understand user intent, extract parameters from natural language, and route requests to the right tools (MCP servers or built-in handlers). The system supports parallel tool execution for complex queries and maintains chat history for context-aware responses.

- **Intelligent Router**: AI-powered tool selection with parameter extraction from natural language queries
- **Race-Based Retry**: Fires initial request and retry in parallel, using whichever completes first for reliability
- **Unified Tool Registry**: Central registry managing MCP tools (Salesforce, Hugging Face) and built-in tools (Weather, web search)



## Running the Application

```bash
# Set environment variables
export ZOOM_CLIENT_ID="your_zoom_client_id"
export ZOOM_CLIENT_SECRET="your_zoom_client_secret"
export ZOOM_SECRET_TOKEN="your_zoom_secret_token"
export GROQ_API_KEY="your_groq_api_key"

# Run locally
deno task serve

# Deploy to Deno Deploy
deployctl deploy --project=your-project main.js
```

## Available Agents

### Agent-1: The Thoughtful Assistant
- **Philosophy**: "Better to stay silent than be annoying"
- **Architecture**: Poke-inspired orchestration (Interaction Agent + Execution Agent)
- **Best For**: Background assistance, discovery mode, meeting contexts, active Q&A sessions
- **Characteristics**: Filters outputs, stays silent when appropriate, rate-limited discoveries, intelligent routing

**Key Innovation**: Separates eager execution from thoughtful presentation
- **Interaction Agent** acts as gatekeeper, decides what reaches user
- **Execution Agent** can be thorough without being annoying
- Inspired by [Poke's multi-agent architecture](https://shlokkhemani.com/writing/openpoke)

**Features**:
- Intelligent tool routing and selection
- Context-aware response filtering
- Multi-tool request handling
- Scratchpad for meeting notes
- Discovery mode support
- Progress broadcasting via SSE




## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Disclaimer

This is a demo project built with Zoom RTMS, and powered by Groq's fast inference and remote MCP server connectors. It's also mostly been vibe coded so use with caution!

## License

MIT License - see LICENSE file for details

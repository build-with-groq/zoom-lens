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



## Prerequisites

- [Deno](https://deno.com/) runtime
- Zoom App Marketplace account with RTMS enabled
- Environment variables configured (see below)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zoom-lens-project/zoom-lens-v2
   ```

2. **Install dependencies**
   ```bash
   # Dependencies are automatically managed by Deno
   # No npm install required
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:

   ```env
   # Zoom RTMS Credentials (from Zoom App Marketplace)
   ZOOM_CLIENT_ID=your_zoom_client_id
   ZOOM_CLIENT_SECRET=your_zoom_client_secret
   ZOOM_SECRET_TOKEN=your_zoom_secret_token

   # Optional: Custom webhook path (defaults to /webhook)
   WEBHOOK_PATH=/webhook
   
   # Groq API Key
   GROQ_API_KEY=your_groq_api_key
   
   # Salesforce MCP Configuration
   SALESFORCE_MCP_URL=your_salesforce_mcp_url
   
   # AI Model Configuration (Optional - Override to test different models)
   # All default to their specified fallback models if not set
   
   # Intelligent routing decisions (default: openai/gpt-oss-20b)
   MODEL_ROUTER=openai/gpt-oss-20b
   
   # Discovery mode analysis (default: openai/gpt-oss-20b)
   MODEL_DISCOVERY=openai/gpt-oss-20b
   
   # Fact extraction from research (default: openai/gpt-oss-20b)
   MODEL_EXTRACTOR=openai/gpt-oss-20b
   
   # Text compression/distillation (default: openai/gpt-oss-20b)
   MODEL_COMPRESSOR=openai/gpt-oss-20b
   
   # Main inference with MCP tools (default: openai/gpt-oss-120b)
   MODEL_INFERENCE=openai/gpt-oss-120b
   
   # Direct answers without tools (default: openai/gpt-oss-120b)
   MODEL_DIRECT_ANSWER=openai/gpt-oss-120b
   
   # Multi-tool response synthesis (default: openai/gpt-oss-120b)
   MODEL_SYNTHESIS=openai/gpt-oss-120b
   ```

## Running the Application

### Development Mode
```bash
deno task serve
# or directly:
deno serve --port 9995 --watch --allow-read --allow-env --allow-write --allow-net ./main.js
```

### Production Deployment
```bash
deno task prod
```

The application will be available at:
- **Main UI**: `http://localhost:9995/`
- **Webhook Endpoint**: `http://localhost:9995/webhook`
- **SSE Stream**: `http://localhost:9995/events`

## Zoom RTMS Configuration

1. **Create a Zoom App** in the [Zoom App Marketplace](https://marketplace.zoom.us/)
2. **Enable RTMS** in your app settings
3. **Configure Webhook URL** pointing to your deployed endpoint
4. **Set Event Types** to include:
   - `meeting.rtms_started`
   - `meeting.rtms_stopped`
   - `endpoint.url_validation`

## Agent Design

The Zoom Lens V2 architecture is designed with modularity in mind—you can easily swap out the default agent implementation with other experimental agents. Each agent variant can be placed in its own directory under `/experiments/agent-{n}` while sharing common utilities and infrastructure from the `/utils` directory. This allows for easy experimentation and comparison of different agent approaches.

### Assistant Design

The default agent implementation uses a dual-agent architecture consisting of an Interaction Agent and an Execution Agent, based on [Poke's multi-agent design](https://shlokkhemani.com/writing/openpoke). The Interaction Agent functions as a filter layer that evaluates whether responses should be presented to the user, while the Execution Agent performs tool execution and information gathering without presentation constraints. The intelligent routing system analyzes user intent and spawns separate agent instances for individual tool calls, enabling parallel execution of multiple tools independently. The system implements request deduplication, rate-limited discovery operations, and maintains chat history for context. It provides a scratchpad for meeting notes and broadcasts progress updates via Server-Sent Events.

## Documentation

- [Zoom RTMS Documentation](https://developers.zoom.us/docs/rtms/)
- [Groq Compound API](https://console.groq.com/docs/compound/systems/compound)
- [Hono Framework](https://hono.dev/)
- [Deno Deploy](https://deno.com/deploy)

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

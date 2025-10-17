# Zoom RTMS Transcript Service

A real-time transcript streaming service for Zoom meetings using the Zoom Real-Time Meeting Service (RTMS) API. This demo showcases live transcription capabilities and is designed to integrate with Groq Compound for advanced AI processing.

## 🚀 Features

- **Real-Time Transcription**: Live transcript streaming from Zoom meetings
- **WebSocket Integration**: Direct connection to Zoom's RTMS WebSocket endpoints
- **Server-Sent Events**: Real-time UI updates for transcript display
- **Webhook Handling**: Automatic handling of Zoom RTMS lifecycle events
- **Security Headers**: OWASP-compliant security headers implementation
- **Cross-Platform**: Runs on Deno, compatible with Val Town deployment
- **Future AI Integration**: Planned integration with Groq Compound for intelligent transcript processing

## 📋 Prerequisites

- [Deno](https://deno.com/) runtime
- Zoom App Marketplace account with RTMS enabled
- Environment variables configured (see below)

## 🔧 Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zoom-rtms
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
   ```

## 🏃 Running the Application

### Development Mode
```bash
deno task print
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

## 🏗️ Architecture

### Components

1. **Webhook Handler** (`/webhook`)
   - Receives RTMS lifecycle events from Zoom
   - Handles meeting start/stop notifications
   - Validates webhook signatures

2. **WebSocket Connections**
   - **Signaling WebSocket**: Establishes RTMS session
   - **Media WebSocket**: Receives real-time transcript data

3. **Server-Sent Events** (`/events`)
   - Streams transcript data to connected clients
   - Cross-isolate broadcasting for Deno Deploy

4. **Live UI** (`/`)
   - Real-time transcript display
   - EventSource-based updates
   - Dark theme with monospace font (Menlo)

### Data Flow

```
Zoom Meeting → RTMS Webhook → Signaling WS → Media WS → Transcripts → SSE → UI
```

## 🔐 Zoom RTMS Configuration

1. **Create a Zoom App** in the [Zoom App Marketplace](https://marketplace.zoom.us/)
2. **Enable RTMS** in your app settings
3. **Configure Webhook URL** pointing to your deployed endpoint
4. **Set Event Types** to include:
   - `meeting.rtms_started`
   - `meeting.rtms_stopped`
   - `endpoint.url_validation`

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Live transcript viewer UI |
| `/webhook` | POST | Zoom RTMS webhook handler |
| `/events` | GET | Server-Sent Events stream |

## 🚀 Future Integration: Groq Compound

This project is designed to integrate with [Groq Compound](https://console.groq.com/docs/compound/systems/compound) for intelligent transcript processing:

- **Real-time Analysis**: Process transcripts as they're received
- **Summarization**: Generate meeting summaries automatically
- **Action Items**: Extract tasks and follow-ups
- **Sentiment Analysis**: Analyze participant engagement
- **Translation**: Real-time language translation
- **Q&A**: Answer questions about meeting content

### Planned Features
- Live transcript enhancement
- Automated meeting minutes
- Keyword extraction and tagging
- Speaker identification improvements
- Content moderation and filtering

## 📚 Documentation

- [Zoom RTMS Documentation](https://developers.zoom.us/docs/rtms/)
- [Groq Compound API](https://console.groq.com/docs/compound/systems/compound)
- [Hono Framework](https://hono.dev/)
- [Deno Deploy](https://deno.com/deploy)

## 🔧 Development

### Code Structure
```
├── main.js          # Main application
├── deno.json        # Deno configuration
├── deno.lock        # Dependency lock file
└── README.md        # This file
```

### Key Technologies
- **Runtime**: Deno
- **Framework**: Hono
- **WebSockets**: Native WebSocket API
- **Security**: OWASP-compliant headers
- **Deployment**: Deno Deploy compatible

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

This is a demonstration project for educational and development purposes. Ensure compliance with Zoom's terms of service and data privacy regulations when handling meeting transcripts.</content>
</xai:function_call">README.md

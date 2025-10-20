# AI Model Configuration Changes

## Summary
All hardcoded AI model references have been replaced with dynamic environment variables that can be overridden in `.env` for quick testing of different models.

## New Environment Variables

Added to `config.js`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MODEL_ROUTER` | `openai/gpt-oss-20b` | Intelligent routing decisions - analyzes queries and selects tools |
| `MODEL_DISCOVERY` | `openai/gpt-oss-20b` | Discovery mode analysis - identifies background info opportunities |
| `MODEL_EXTRACTOR` | `openai/gpt-oss-20b` | Fact extraction - pulls key facts from research results |
| `MODEL_COMPRESSOR` | `openai/gpt-oss-20b` | Text compression - distills text to brief statements |
| `MODEL_INFERENCE` | `openai/gpt-oss-120b` | Main inference with MCP tools - handles complex queries |
| `MODEL_DIRECT_ANSWER` | `openai/gpt-oss-120b` | Direct answers without tools - conversational responses |
| `MODEL_SYNTHESIS` | `openai/gpt-oss-120b` | Multi-tool synthesis - combines results from multiple tools |

## Files Modified

### 1. `config.js`
- Added 7 new model configuration exports with env variable support and fallbacks

### 2. `main.js`
- Updated imports to include `MODEL_DISCOVERY`, `MODEL_EXTRACTOR`, `MODEL_COMPRESSOR`
- Replaced 3 hardcoded model references:
  - Discovery analysis endpoint (line ~868)
  - Researcher/fact extraction (line ~941)
  - Text compressor/distillation (line ~962)

### 3. `ai-inference.js`
- Updated imports to include `MODEL_ROUTER`, `MODEL_INFERENCE`, `MODEL_DIRECT_ANSWER`, `MODEL_SYNTHESIS`
- Replaced 4 hardcoded model references:
  - Intelligent router (line ~366)
  - Main inference with MCP tools (line ~1095)
  - Direct answer function (line ~695)
  - Multi-tool synthesis (line ~1393)

### 4. `groq-router.js` (Legacy - Not Currently Used)
- Added MODEL_ROUTER variable to initialization function
- Updated model reference to use dynamic variable (line ~233)
- Note: This file appears to be legacy code - routing is now in `ai-inference.js`

### 5. `README.md`
- Added comprehensive documentation of all new model configuration variables
- Included descriptions and default values for each model setting

## Usage

### Quick Model Testing
Simply override any model in your `.env` file:

```env
# Test a different model for routing
MODEL_ROUTER=meta-llama/llama-3.2-3b-preview

# Test a larger model for inference
MODEL_INFERENCE=openai/gpt-oss-180b

# Mix and match as needed
MODEL_DISCOVERY=openai/gpt-oss-40b
MODEL_EXTRACTOR=openai/gpt-oss-20b
```

### Fallback Behavior
If an environment variable is not set, the system uses the hardcoded default:
- Lightweight tasks (routing, extraction, compression): `openai/gpt-oss-20b`
- Heavy tasks (inference, synthesis): `openai/gpt-oss-120b`

## Benefits

1. **Quick Testing**: Switch models without touching code
2. **Cost Optimization**: Use cheaper models for simple tasks
3. **Performance Tuning**: Test different models for different operations
4. **Development Flexibility**: Easy A/B testing of model performance
5. **Production Safety**: Sensible defaults if env vars aren't set

## Example Scenarios

### Budget Mode
```env
MODEL_ROUTER=openai/gpt-oss-20b
MODEL_DISCOVERY=openai/gpt-oss-20b
MODEL_EXTRACTOR=openai/gpt-oss-20b
MODEL_COMPRESSOR=openai/gpt-oss-20b
MODEL_INFERENCE=openai/gpt-oss-40b
MODEL_DIRECT_ANSWER=openai/gpt-oss-40b
MODEL_SYNTHESIS=openai/gpt-oss-40b
```

### Performance Mode
```env
MODEL_ROUTER=openai/gpt-oss-40b
MODEL_DISCOVERY=openai/gpt-oss-40b
MODEL_EXTRACTOR=openai/gpt-oss-40b
MODEL_COMPRESSOR=openai/gpt-oss-40b
MODEL_INFERENCE=openai/gpt-oss-180b
MODEL_DIRECT_ANSWER=openai/gpt-oss-180b
MODEL_SYNTHESIS=openai/gpt-oss-180b
```

### Balanced (Default)
No env vars needed - uses hardcoded defaults:
- Simple tasks: `openai/gpt-oss-20b` (fast and efficient)
- Complex tasks: `openai/gpt-oss-120b` (powerful and accurate)


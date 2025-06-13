# Tool Adapters

A lightweight library for defining and converting tools across different AI SDKs. Define your tools once, use them anywhere.

## Installation

```bash
pnpm add tool-adapters
```

## Quick Start

```typescript
import { tool } from "tool-adapters"
import { z } from "zod"
import { toAnthropicTools, handleToolCalls } from "tool-adapters/anthropic"

// Define your tools
const baseTools = [
  tool({
    name: "get_weather",
    description: "Get current weather for a location",
    parameters: z.object({ location: z.string() }),
    execute: async ({ location }) => {
      // Your implementation here
      return { temperature: 20, humidity: 50 }
    }
  })
]

// Convert to SDK-specific format
const tools = toAnthropicTools(baseTools)

// Use with your preferred SDK
const response = await client.messages.create({
  messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  tools
  // ... other config
})

// Handle tool calls
const toolResults = await handleToolCalls(response, baseTools)
```

## Supported SDKs

- Anthropic
- OpenAI (Chat Completions & Responses)
- Google AI
- Vercel AI SDK

## API

### SDK Adapters

#### Anthropic

```typescript
import { toAnthropicTools, handleToolCalls } from "tool-adapters/anthropic"
```

#### OpenAI

```typescript
import {
  toChatCompletionTools,
  handleChatCompletionToolCalls,
  toResponsesTools,
  handleResponsesToolCalls
} from "tool-adapters/openai"
```

#### Google AI

```typescript
import {
  toFunctionDeclarations,
  handleFunctionCalls
} from "tool-adapters/google"
```

#### Vercel AI SDK

```typescript
import { toVercelTools } from "tool-adapters/vercel"
```

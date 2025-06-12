import { createAnthropic } from "@ai-sdk/anthropic"
import Anthropic from "@anthropic-ai/sdk"
import { GoogleGenAI } from "@google/genai"
import { generateText } from "ai"
import OpenAI from "openai"
import { expect, test } from "vitest"
import { z } from "zod"
import {
  handleToolCalls as handleAnthropicToolCalls,
  toAnthropicTools
} from "./anthropic"
import { env } from "../env"
import { tool } from "../tool"
import {
  handleFunctionCalls as handleGoogleFunctionCalls,
  toFunctionDeclarations
} from "./google"
import {
  handleChatCompletionToolCalls,
  handleResponsesToolCalls,
  toChatCompletionTools,
  toResponsesTools
} from "./openai"
import { toVercelTools } from "./vercel"

const mockResult = {
  temperature: 20,
  humidity: 50
}

const systemPrompt =
  "When you receive weather results, respond with just 'ACK'."

const baseTools = [
  tool({
    name: "get_weather",
    description: "provide the user with their current weather",
    parameters: z.object({ location: z.string() }),
    execute: ({ location: _ }) => {
      return mockResult
    }
  })
]

test("anthropic sdk", async () => {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY
  })

  const messages = [
    { role: "user" as const, content: "What is the weather in Tokyo?" }
  ]

  const response = await client.messages.create({
    max_tokens: 1024,
    messages,
    model: "claude-3-5-haiku-latest",
    tools: toAnthropicTools(baseTools),
    system: systemPrompt
  })

  const toolUse = response.content.find((block) => block.type === "tool_use")

  expect(toolUse?.name).toBe("get_weather")
  expect(toolUse?.input).toEqual({ location: "Tokyo" })

  const toolResults = await handleAnthropicToolCalls(response, baseTools)
  expect(toolResults[0]).toEqual({
    type: "tool_result",
    tool_use_id: toolUse?.id,
    content: JSON.stringify(mockResult)
  })

  const result2 = await client.messages.create({
    max_tokens: 1024,
    messages: [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults }
    ],
    model: "claude-3-5-haiku-latest",
    tools: toAnthropicTools(baseTools),
    system: systemPrompt
  })

  const textBlock = result2.content.find((block) => block.type === "text")
  expect(textBlock?.text).toContain("ACK")
})

test("openai chat completion", async () => {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  })

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: "What is the weather in Tokyo?" }
  ]

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools: toChatCompletionTools(baseTools)
  })

  const toolCall = result.choices[0]?.message.tool_calls?.[0]

  expect(toolCall?.function.name).toBe("get_weather")
  expect(toolCall?.function.arguments).toEqual(
    JSON.stringify({ location: "Tokyo" })
  )

  const message = result.choices[0]?.message

  if (!message) {
    throw new Error("No message")
  }

  const toolMessages = await handleChatCompletionToolCalls(message, baseTools)
  expect(toolMessages[0]).toEqual({
    role: "tool",
    tool_call_id: toolCall?.id,
    content: JSON.stringify(mockResult)
  })

  const result2 = await client.chat.completions.create({
    messages: [...messages, message, ...toolMessages],
    model: "gpt-4o-mini",
    tools: toChatCompletionTools(baseTools)
  })

  expect(result2.choices[0]?.message.content).toContain("ACK")
})

test("openai responses", async () => {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  })

  const response = await client.responses.create({
    input: "What is the weather in Tokyo?",
    model: "gpt-4o-mini",
    tools: toResponsesTools(baseTools),
    instructions: systemPrompt
  })

  const functionCall = response.output.find(
    (item) => item.type === "function_call"
  )

  expect(functionCall?.name).toBe("get_weather")
  expect(functionCall?.arguments).toEqual(JSON.stringify({ location: "Tokyo" }))

  const toolResults = await handleResponsesToolCalls(response, baseTools)
  expect(toolResults[0]).toEqual({
    type: "function_call_output",
    call_id: functionCall?.call_id,
    output: JSON.stringify(mockResult)
  })

  const response2 = await client.responses.create({
    input: [
      { role: "user", content: "What is the weather in Tokyo?" },
      ...response.output,
      ...toolResults
    ],
    model: "gpt-4o-mini",
    tools: toResponsesTools(baseTools),
    instructions: systemPrompt
  })

  expect(response2.output_text).toContain("ACK")
})

test("google gen ai", async () => {
  const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY })

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "What is the weather in Tokyo?",
    config: {
      tools: [{ functionDeclarations: toFunctionDeclarations(baseTools) }],
      systemInstruction: systemPrompt
    }
  })

  const functionCall = response.functionCalls?.[0]

  expect(functionCall?.name).toBe("get_weather")
  expect(functionCall?.args).toEqual({ location: "Tokyo" })

  const modelResponseContent = response.candidates?.[0]?.content

  if (!modelResponseContent) {
    throw new Error("No model response conent")
  }

  const functionResults = await handleGoogleFunctionCalls(response, baseTools)

  expect(functionResults[0]).toEqual({
    name: "get_weather",
    response: { result: mockResult }
  })

  const response2 = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      { role: "user", parts: [{ text: "What is the weather in Tokyo?" }] },
      modelResponseContent,
      {
        role: "user",
        parts: functionResults.map((r) => ({ functionResponse: r }))
      }
    ],
    config: {
      tools: [{ functionDeclarations: toFunctionDeclarations(baseTools) }],
      systemInstruction: systemPrompt
    }
  })

  const response2Text = response2.text
  expect(response2Text).toContain("ACK")
})

test("vercel", async () => {
  const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY
  })

  const result = await generateText({
    maxSteps: 2,
    model: anthropic("claude-3-5-haiku-latest"),
    prompt: "What is the weather in Tokyo?",
    tools: toVercelTools(baseTools),
    system: systemPrompt
  })

  const toolCall = result.steps[0]?.toolCalls[0]

  expect(toolCall?.toolName).toBe("get_weather")
  expect(toolCall?.args).toEqual({ location: "Tokyo" })

  expect(result.text).toContain("ACK")
})

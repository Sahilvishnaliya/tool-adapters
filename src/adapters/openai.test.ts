import { expect, test } from "vitest"
import { z } from "zod"
import type OpenAI from "openai"
import {
  handleChatCompletionToolCalls,
  handleResponsesToolCalls,
  toChatCompletionTools,
  toResponsesTools
} from "./openai"
import { tool } from "../tool"

const mockResult = { temperature: 20, humidity: 50 }

const tools = [
  tool({
    name: "get_weather",
    description: "Get weather",
    parameters: z.object({ location: z.string() }),
    execute: ({ location: _ }) => mockResult
  }),
  tool({
    name: "set_temp",
    description: "All-optional params",
    parameters: z.object({
      celsius: z.number().optional(),
      fahrenheit: z.number().optional()
    }),
    execute: (args) => args
  })
]

const chatMessage = {
  tool_calls: [
    {
      id: "call_known",
      type: "function",
      function: {
        name: "get_weather",
        arguments: JSON.stringify({ location: "Tokyo" })
      }
    },
    {
      id: "call_unknown",
      type: "function",
      function: { name: "get_forecast", arguments: "{}" }
    }
  ]
} as unknown as OpenAI.Chat.ChatCompletionMessage

const responsesCall = {
  output: [
    {
      type: "function_call",
      name: "get_weather",
      arguments: JSON.stringify({ location: "Tokyo" }),
      call_id: "call_known"
    },
    {
      type: "function_call",
      name: "get_forecast",
      arguments: "{}",
      call_id: "call_unknown"
    }
  ]
} as unknown as OpenAI.Responses.Response

test("toChatCompletionTools sends a parameters schema without $schema", () => {
  const converted = toChatCompletionTools(tools)
  const parameters = converted[0]?.function.parameters
  if (!parameters) {
    throw new Error("missing parameters for get_weather")
  }
  expect("$schema" in parameters).toBe(false)
  expect(parameters).toEqual({
    type: "object",
    properties: { location: { type: "string" } },
    required: ["location"],
    additionalProperties: false
  })
})

test("toResponsesTools requires all properties under strict mode", () => {
  const converted = toResponsesTools(tools)
  const allOptional = converted[1]

  expect(allOptional?.strict).toBe(true)
  expect(allOptional?.parameters?.["required"]).toEqual([
    "celsius",
    "fahrenheit"
  ])
  expect(allOptional?.parameters?.["additionalProperties"]).toBe(false)
})

test("toResponsesTools emits keys in OpenAI's expected order", () => {
  const converted = toResponsesTools(tools)
  const parameters = converted[1]?.parameters
  if (!parameters) {
    throw new Error("missing parameters for set_temp")
  }
  expect(Object.keys(parameters)).toEqual([
    "type",
    "properties",
    "required",
    "additionalProperties"
  ])
})

test("chat completions executes tools with parsed arguments", async () => {
  const results = await handleChatCompletionToolCalls(chatMessage, tools)
  expect(results).toHaveLength(2)
  expect(results[0]).toEqual({
    role: "tool",
    tool_call_id: "call_known",
    content: JSON.stringify(mockResult)
  })
})

test("chat completions returns an error result for unknown tool names", async () => {
  const results = await handleChatCompletionToolCalls(chatMessage, tools)
  expect(results[1]).toEqual({
    role: "tool",
    tool_call_id: "call_unknown",
    content: JSON.stringify({ error: "Unknown tool: get_forecast" })
  })
})

test("chat completions validates tool arguments against the zod schema", async () => {
  const invalid = {
    tool_calls: [
      {
        id: "call_bad",
        type: "function",
        function: {
          name: "get_weather",
          arguments: JSON.stringify({ location: 123 })
        }
      }
    ]
  } as unknown as OpenAI.Chat.ChatCompletionMessage

  await expect(handleChatCompletionToolCalls(invalid, tools)).rejects.toThrow(
    /Expected string, received number/
  )
})

test("responses executes tools with parsed arguments", async () => {
  const results = await handleResponsesToolCalls(responsesCall, tools)
  expect(results).toHaveLength(2)
  expect(results[0]).toEqual({
    type: "function_call_output",
    call_id: "call_known",
    output: JSON.stringify(mockResult)
  })
})

test("responses returns an error result for unknown tool names", async () => {
  const results = await handleResponsesToolCalls(responsesCall, tools)
  expect(results[1]).toEqual({
    type: "function_call_output",
    call_id: "call_unknown",
    output: JSON.stringify({ error: "Unknown tool: get_forecast" })
  })
})

import { expect, test } from "vitest"
import { z } from "zod"
import type { Anthropic } from "@anthropic-ai/sdk"
import { handleToolCalls, toAnthropicTools } from "./anthropic"
import { tool } from "../tool"

const mockResult = { temperature: 20, humidity: 50 }

const tools = [
  tool({
    name: "get_weather",
    description: "Get weather",
    parameters: z.object({ location: z.string() }),
    execute: ({ location: _ }) => mockResult
  })
]

const message = {
  content: [
    {
      type: "tool_use",
      id: "tu_known",
      name: "get_weather",
      input: { location: "Tokyo" }
    },
    {
      type: "tool_use",
      id: "tu_unknown",
      name: "get_forecast",
      input: {}
    }
  ]
} as unknown as Anthropic.Message

test("toAnthropicTools sends a parameters schema without $schema", () => {
  const converted = toAnthropicTools(tools)
  const schema = converted[0]?.input_schema
  if (!schema) {
    throw new Error("missing input_schema for get_weather")
  }
  expect("$schema" in schema).toBe(false)
  expect(schema.type).toBe("object")
  expect(schema.required).toEqual(["location"])
})

test("executes tools with parsed input", async () => {
  const results = await handleToolCalls(message, tools)
  expect(results).toHaveLength(2)
  expect(results[0]).toEqual({
    type: "tool_result",
    tool_use_id: "tu_known",
    content: JSON.stringify(mockResult)
  })
})

test("returns an error result for unknown tool names", async () => {
  const results = await handleToolCalls(message, tools)
  expect(results[1]).toEqual({
    type: "tool_result",
    tool_use_id: "tu_unknown",
    is_error: true,
    content: JSON.stringify({ error: "Unknown tool: get_forecast" })
  })
})

test("validates tool input against the zod schema", async () => {
  const invalid = {
    content: [
      {
        type: "tool_use",
        id: "tu_bad",
        name: "get_weather",
        input: { location: 123 }
      }
    ]
  } as unknown as Anthropic.Message

  await expect(handleToolCalls(invalid, tools)).rejects.toThrow(
    /Expected string, received number/
  )
})

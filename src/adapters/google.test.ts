import { expect, test } from "vitest"
import { z } from "zod"
import type { GenerateContentResponse } from "@google/genai"
import { handleFunctionCalls, toFunctionDeclarations } from "./google"
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

const response = {
  functionCalls: [
    { name: "get_weather", args: { location: "Tokyo" } },
    { name: "get_forecast", args: {} }
  ]
} as unknown as GenerateContentResponse

test("toFunctionDeclarations sends a parameters schema without $schema", () => {
  const converted = toFunctionDeclarations(tools)
  const parameters = converted[0]?.parameters
  if (!parameters) {
    throw new Error("missing parameters for get_weather")
  }
  expect("$schema" in parameters).toBe(false)
  expect(parameters["type"]).toBe("object")
  expect(parameters["required"]).toEqual(["location"])
})

test("executes tools with parsed arguments", async () => {
  const results = await handleFunctionCalls(response, tools)
  expect(results).toHaveLength(2)
  expect(results[0]).toEqual({
    name: "get_weather",
    response: { result: mockResult }
  })
})

test("returns an error result for unknown tool names", async () => {
  const results = await handleFunctionCalls(response, tools)
  expect(results[1]).toEqual({
    name: "get_forecast",
    response: { error: "Unknown tool: get_forecast" }
  })
})

test("validates tool arguments against the zod schema", async () => {
  const invalid = {
    functionCalls: [{ name: "get_weather", args: { location: 123 } }]
  } as unknown as GenerateContentResponse

  await expect(handleFunctionCalls(invalid, tools)).rejects.toThrow(
    /Expected string, received number/
  )
})

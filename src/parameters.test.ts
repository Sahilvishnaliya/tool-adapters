import { expect, test } from "vitest"
import { z } from "zod"
import { toParameterSchema, toStrictParameterSchema } from "./parameters"
import { tool } from "./tool"

const requiredFieldTool = tool({
  name: "get_weather",
  description: "provide the user with their current weather",
  parameters: z.object({ location: z.string() }),
  execute: () => ({ temperature: 20 })
})

const allOptionalTool = tool({
  name: "opt",
  description: "all optional",
  parameters: z.object({
    a: z.string().optional(),
    b: z.number().optional()
  }),
  execute: (args) => args
})

const emptyObjectTool = tool({
  name: "empty",
  description: "no params",
  parameters: z.object({}),
  execute: (args) => args
})

const nestedTool = tool({
  name: "nested",
  description: "nested objects",
  parameters: z.object({
    outer: z.object({
      inner: z.string().optional(),
      list: z.array(z.object({ value: z.number().optional() }))
    })
  }),
  execute: (args) => args
})

test("toParameterSchema strips the root $schema key", () => {
  const schema = toParameterSchema(requiredFieldTool)
  expect("$schema" in schema).toBe(false)
  expect(schema).toEqual({
    type: "object",
    properties: { location: { type: "string" } },
    required: ["location"],
    additionalProperties: false
  })
})

test("toStrictParameterSchema adds required for all-optional objects", () => {
  const schema = toStrictParameterSchema(allOptionalTool)
  expect(schema["required"]).toEqual(["a", "b"])
  expect(schema["additionalProperties"]).toBe(false)
})

test("toStrictParameterSchema emits keys in OpenAI's expected order", () => {
  const schema = toStrictParameterSchema(allOptionalTool)
  expect(Object.keys(schema)).toEqual([
    "type",
    "properties",
    "required",
    "additionalProperties"
  ])
})

test("toStrictParameterSchema handles empty object schemas", () => {
  const schema = toStrictParameterSchema(emptyObjectTool)
  expect(schema["required"]).toEqual([])
  expect(schema["additionalProperties"]).toBe(false)
})

test("toStrictParameterSchema strictifies nested objects and array items", () => {
  const schema = toStrictParameterSchema(nestedTool)
  const outer = schema["properties"] as Record<string, Record<string, unknown>>
  expect(outer["outer"]?.["required"]).toEqual(["inner", "list"])

  const list = outer["outer"]?.["properties"] as Record<
    string,
    Record<string, unknown>
  >
  expect(list["list"]?.["type"]).toBe("array")

  const items = list["list"]?.["items"] as Record<string, unknown>
  expect(items["type"]).toBe("object")
  expect(items["required"]).toEqual(["value"])
  expect(items["additionalProperties"]).toBe(false)
})

import zodToJsonSchema from "zod-to-json-schema"
import type { ToolBase } from "./tool"

type JsonSchemaNode = Record<string, unknown>

/**
 * Converts a tool's Zod parameters to a JSON Schema without the root "$schema"
 * meta key, which is not a valid parameters field for Anthropic, OpenAI, or
 * Google tool definitions.
 */
export function toParameterSchema(tool: ToolBase): JsonSchemaNode {
  const schema = zodToJsonSchema(tool.parameters) as JsonSchemaNode & {
    $schema?: unknown
  }
  const { $schema: _ignored, ...rest } = schema
  return rest
}

/**
 * Converts a tool's Zod parameters to a JSON Schema conforming to OpenAI's
 * structured-outputs (strict mode) requirements: every object level lists the
 * names of all of its properties under `required` and sets
 * `additionalProperties: false` after them.
 */
export function toStrictParameterSchema(tool: ToolBase): JsonSchemaNode {
  return toStrictObject(toParameterSchema(tool))
}

function isRecord(value: unknown): value is JsonSchemaNode {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toStrictValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStrictValue)
  }
  if (!isRecord(value)) {
    return value
  }
  return toStrictObject(value)
}

function toStrictObject(node: JsonSchemaNode): JsonSchemaNode {
  if (node["type"] !== "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, toStrictValue(value)])
    )
  }

  const properties: Record<string, unknown> = {}
  const rawProperties = node["properties"]
  if (isRecord(rawProperties)) {
    for (const [name, value] of Object.entries(rawProperties)) {
      properties[name] = toStrictValue(value)
    }
  }

  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...Object.fromEntries(
      Object.entries(node).filter(
        ([key]) =>
          key !== "type" &&
          key !== "properties" &&
          key !== "required" &&
          key !== "additionalProperties"
      )
    )
  }
}

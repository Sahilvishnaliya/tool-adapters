import zodToJsonSchema from "zod-to-json-schema"
import { getToolMap } from "../tool"
import type { ToolBase } from "../tool"
import type { Anthropic } from "@anthropic-ai/sdk"

export function toAnthropicTools(tools: ToolBase[]): Anthropic.Tool[] {
  return tools.map((tool) => {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        ...zodToJsonSchema(tool.parameters),
        type: "object"
      }
    }
  })
}

export async function handleToolCalls(
  message: Anthropic.Message,
  tools: ToolBase[]
): Promise<Anthropic.ToolResultBlockParam[]> {
  const toolCalls = message.content.filter((block) => block.type === "tool_use")

  const toolMap = getToolMap(tools)

  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const tool = toolMap.get(toolCall.name)
      if (!tool) {
        return
      }

      const response = (await tool.execute(toolCall.input)) as unknown

      const toolResult: Anthropic.ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: toolCall.id,
        content: JSON.stringify(response)
      }

      return toolResult
    })
  )

  return toolResults.filter((r) => !!r)
}

import { toParameterSchema } from "../parameters"
import { getToolMap } from "../tool"
import type { ToolBase } from "../tool"
import type { Anthropic } from "@anthropic-ai/sdk"

export function toAnthropicTools(tools: ToolBase[]): Anthropic.Tool[] {
  return tools.map((tool) => {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        ...toParameterSchema(tool),
        type: "object" as const
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
        return {
          type: "tool_result" as const,
          tool_use_id: toolCall.id,
          is_error: true,
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` })
        }
      }

      const args: unknown = tool.parameters.parse(toolCall.input)
      const response = (await tool.execute(args)) as unknown

      return {
        type: "tool_result" as const,
        tool_use_id: toolCall.id,
        content: JSON.stringify(response)
      }
    })
  )

  return toolResults.filter((r) => !!r)
}

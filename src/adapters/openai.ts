import { toParameterSchema, toStrictParameterSchema } from "../parameters"
import { getToolMap } from "../tool"
import type { ToolBase } from "../tool"
import type OpenAI from "openai"

export function toChatCompletionTools(
  tools: ToolBase[]
): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toParameterSchema(
        tool
      ) as OpenAI.FunctionDefinition["parameters"]
    }
  }))
}

export async function handleChatCompletionToolCalls(
  message: OpenAI.Chat.ChatCompletionMessage,
  tools: ToolBase[]
): Promise<OpenAI.Chat.ChatCompletionToolMessageParam[]> {
  const toolCalls = message.tool_calls ?? []

  const toolMap = getToolMap(tools)

  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const tool = toolMap.get(toolCall.function.name)
      if (!tool) {
        return {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: `Unknown tool: ${toolCall.function.name}`
          })
        }
      }

      const args: unknown = tool.parameters.parse(
        JSON.parse(toolCall.function.arguments)
      )
      const response = (await tool.execute(args)) as unknown

      return {
        role: "tool" as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify(response)
      }
    })
  )

  return results.filter((r) => !!r)
}

export function toResponsesTools(
  tools: ToolBase[]
): OpenAI.Responses.FunctionTool[] {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: toStrictParameterSchema(
      tool
    ) as OpenAI.Responses.FunctionTool["parameters"],
    strict: true
  }))
}

export async function handleResponsesToolCalls(
  response: OpenAI.Responses.Response,
  tools: ToolBase[]
): Promise<OpenAI.Responses.ResponseInputItem.FunctionCallOutput[]> {
  const toolCalls = response.output.filter(
    (item) => item.type === "function_call"
  )

  const toolMap = getToolMap(tools)

  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const tool = toolMap.get(toolCall.name)
      if (!tool) {
        return {
          type: "function_call_output" as const,
          call_id: toolCall.call_id,
          output: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` })
        }
      }

      const args: unknown = tool.parameters.parse(
        JSON.parse(toolCall.arguments)
      )
      const response = (await tool.execute(args)) as unknown

      return {
        type: "function_call_output" as const,
        call_id: toolCall.call_id,
        output: JSON.stringify(response)
      }
    })
  )

  return results.filter((r) => !!r)
}

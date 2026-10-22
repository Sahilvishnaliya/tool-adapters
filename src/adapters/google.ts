import { toParameterSchema } from "../parameters"
import { getToolMap } from "../tool"
import type { ToolBase } from "../tool"
import type {
  FunctionDeclaration,
  FunctionResponse,
  GenerateContentResponse,
  Schema
} from "@google/genai"

export function toFunctionDeclarations(
  tools: ToolBase[]
): FunctionDeclaration[] {
  return tools.map((tool) => ({
    description: tool.description,
    name: tool.name,
    parameters: toParameterSchema(tool) as Schema
  }))
}

export async function handleFunctionCalls(
  response: GenerateContentResponse,
  tools: ToolBase[]
): Promise<FunctionResponse[]> {
  const functionCalls = response.functionCalls ?? []

  const toolMap = getToolMap(tools)

  const functionResults = await Promise.all(
    functionCalls.map(async (functionCall) => {
      const tool = toolMap.get(functionCall.name ?? "unknown")

      if (!tool) {
        return {
          name: functionCall.name,
          response: {
            error: `Unknown tool: ${functionCall.name}`
          }
        }
      }

      const args: unknown = tool.parameters.parse(functionCall.args)
      const result = (await tool.execute(args)) as unknown

      return {
        name: functionCall.name,
        response: { result }
      }
    })
  )

  return functionResults.filter((r) => !!r)
}

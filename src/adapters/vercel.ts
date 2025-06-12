import type { ToolBase } from "../tool"
import type { ToolSet } from "ai"

export function toVercelTools(tools: ToolBase[]): ToolSet {
  return tools.reduce<ToolSet>((acc, tool) => {
    acc[tool.name] = tool
    return acc
  }, {})
}

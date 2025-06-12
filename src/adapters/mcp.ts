import { z } from "zod"
import type { ToolBase } from "../tool"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function addServerTools(server: McpServer, tools: ToolBase[]) {
  for (const tool of tools) {
    if (!(tool.parameters instanceof z.ZodObject)) {
      throw new Error("MCP expects parameters to be an object")
    }

    server.tool(
      tool.name,
      tool.description,
      tool.parameters.shape,
      tool.execute.bind(tool)
    )
  }
}

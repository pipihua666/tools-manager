import { listToolMcpServers, type McpServer } from "./mcp";
import { listAgentSkills, type AgentSkill } from "./skill";
import { getTool, resolveTools, type ToolAdapter } from "./tools";

export type AgentOverview = {
  tool: string;
  displayName: string;
  skillsPath: string;
  mcpPath: string;
  skills: AgentSkill[];
  mcpServers: McpServer[];
};

export async function listAgentOverview(toolInput = "all", tools?: ToolAdapter[]): Promise<AgentOverview[]> {
  const selected = tools ? (toolInput === "all" ? tools : [tools.find((tool) => tool.key === toolInput) || getTool(toolInput)]) : resolveTools(toolInput);
  const skills = await listAgentSkills(toolInput, selected);
  const mcpServers = await listToolMcpServers(toolInput, selected);

  return selected.map((tool) => {
    const toolSkills = skills.find((item) => item.tool === tool.key);
    const toolMcp = mcpServers.find((item) => item.tool === tool.key);
    return {
      tool: tool.key,
      displayName: tool.displayName,
      skillsPath: toolSkills?.path || tool.skillsDir,
      mcpPath: toolMcp?.path || tool.mcpPath,
      skills: toolSkills?.skills || [],
      mcpServers: toolMcp?.servers || [],
    };
  });
}

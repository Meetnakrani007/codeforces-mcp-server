import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";


// 1. Initialize the MCP Server
const server = new McpServer(
    {
        name: "codeforces-mcp-server",
        version: "1.0.0",
    }
);
// 3. Define the Zod Schema for the input
const UserStateInputSchema = z.object({
    handle: z.string().min(1).describe("The codeForces user handle (e.g., tourist)")
});

// Define a simple interface for the tool input to match the schema
interface GetUserStatsInput {
    handle: string;
}
// 4. Define the Tool Options
const getUserStatsToolOptions: any = {
    description: "Fetch complete user profile, rating, rank, and solve counts.",
    inputSchema: UserStateInputSchema,
};


server.registerTool<any, any>(
    "get_user_stats",
    getUserStatsToolOptions,
    async (args: GetUserStatsInput) => {
        const { handle } = args;
        try {
            const response = await axios.get(
                `https://codeforces.com/api/user.info?handles=${handle}`
            );
            if (response.data.status !== "OK") {
                throw new Error("Invalid response from Codeforces API");
            }
            const userData = response.data.result[0];

            return {
                content: [
                    {
                        type: "text" as const, text: JSON.stringify(userData, null, 2)
                    }
                ],
                structuredContent: userData as any,
            };
        }
        catch (error: any) {
            return {
                content: [
                    {
                        type: "text" as const, text: `Failed to fetch user stats: ${error.message}`
                    }
                ],
                isError: true,
            };
        }
    }
);
// 2. Start the server using Standard I/O
(async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Codeforces MCP Server is running on Stdio!");
})();
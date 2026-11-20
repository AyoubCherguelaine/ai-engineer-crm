import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const token = process.env.CRM_API_TOKEN;
if (!token || token.length < 32) {
  console.error(
    "Set CRM_API_TOKEN to the key from your server .env before running this check.",
  );
  process.exit(1);
}
const endpoint = new URL(
  process.argv[2] || process.env.CRM_MCP_URL || "http://localhost:5173/api/mcp",
);
if (
  !["http:", "https:"].includes(endpoint.protocol) ||
  endpoint.username ||
  endpoint.password ||
  endpoint.search
) {
  console.error(
    "Use an HTTP(S) MCP endpoint URL without credentials or query parameters. Authentication is sent in the Authorization header.",
  );
  process.exit(1);
}
const client = new Client({ name: "reach-connection-check", version: "1.0.0" });
try {
  await client.connect(
    new StreamableHTTPClientTransport(endpoint, {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  const tools = await client.listTools();
  const resources = await client.listResources();
  const profile = await client.callTool({ name: "get_profile", arguments: {} });
  if (profile.isError) throw Error("The profile tool could not be read.");
  console.log(
    JSON.stringify(
      {
        connected: true,
        tools: tools.tools.map((tool) => tool.name),
        resources: resources.resources.map((resource) => resource.uri),
        profileReadable: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "MCP connection check failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  await client.close();
}

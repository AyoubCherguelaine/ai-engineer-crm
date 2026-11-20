import "server-only";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireBearerToken, requireSameOrigin } from "../auth.js";
import { ApiError } from "../errors.js";
import { json } from "../http.js";
import { createCrmMcpServer } from "./server.js";

export async function handleMcpRequest(request) {
  let server;
  try {
    requireSameOrigin(request);
    requireBearerToken(request);
    if (request.method !== "POST")
      return json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message:
              "This stateless MCP endpoint accepts POST requests only; it does not open an SSE subscription or retain sessions.",
          },
        },
        405,
        { Allow: "POST" },
      );
    server = createCrmMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 5 * 1024 * 1024,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof ApiError)
      return json(
        { error: error.message },
        error.status,
        error.status === 401
          ? { "WWW-Authenticate": 'Bearer realm="Reach CRM"' }
          : {},
      );
    console.error(
      "CRM MCP request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "The server could not complete this MCP request.",
        },
      },
      500,
    );
  } finally {
    if (server) await server.close();
  }
}

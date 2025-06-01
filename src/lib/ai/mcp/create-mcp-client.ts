import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type MCPServerInfo,
  MCPSseConfigZodSchema,
  MCPStdioConfigZodSchema,
  type MCPServerConfig,
  type MCPToolInfo,
} from "app-types/mcp";
import { jsonSchema, Tool, tool, ToolExecutionOptions } from "ai";
import { isMaybeSseConfig, isMaybeStdioConfig } from "./is-mcp-config";
import logger from "logger";
import type { ConsolaInstance } from "consola";
import { colorize } from "consola/utils";
import {
  createDebounce,
  errorToString,
  isNull,
  Locker,
  toAny,
} from "lib/utils";

import { safe } from "ts-safe";
import { IS_MCP_SERVER_SSE_ONLY } from "lib/const";

type ClientOptions = {
  autoDisconnectSeconds?: number;
};

/**
 * Client class for Model Context Protocol (MCP) server connections
 */
export class MCPClient {
  private client?: Client;
  private error?: unknown;
  private isConnected = false;
  private log: ConsolaInstance;
  private locker = new Locker();
  // Information about available tools from the server
  toolInfo: MCPToolInfo[] = [];
  // Tool instances that can be used for AI functions
  tools: { [key: string]: Tool } = {};

  constructor(
    private name: string,
    private serverConfig: MCPServerConfig,
    private options: ClientOptions = {},
    private disconnectDebounce = createDebounce(),
  ) {
    this.log = logger.withDefaults({
      message: colorize("cyan", `MCP Client ${this.name}: `),
    });
  }

  getInfo(): MCPServerInfo {
    return {
      name: this.name,
      config: this.serverConfig,
      status: this.locker.isLocked
        ? "loading"
        : this.isConnected
          ? "connected"
          : "disconnected",
      error: this.error,
      toolInfo: this.toolInfo,
    };
  }

  private scheduleAutoDisconnect() {
    if (this.options.autoDisconnectSeconds) {
      this.disconnectDebounce(() => {
        this.disconnect();
      }, this.options.autoDisconnectSeconds * 1000);
    }
  }

  /**
   * Connect to the MCP server
   * Do not throw Error
   * @returns this
   */
  async connect() {
    if (this.locker.isLocked) {
      await this.locker.wait();
      return this.client;
    }
    if (this.isConnected) {
      return this.client;
    }
    try {
      const startedAt = Date.now();
      this.locker.lock();

      const client = new Client({
        name: this.name,
        version: "1.0.0",
      });

      // Create appropriate transport based on server config type
      if (isMaybeStdioConfig(this.serverConfig)) {
        // Skip stdio transport
        if (IS_MCP_SERVER_SSE_ONLY) {
          throw new Error("Stdio transport is not supported");
        }

        const config = MCPStdioConfigZodSchema.parse(this.serverConfig);
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          // Merge process.env with config.env, ensuring PATH is preserved and filtering out undefined values
          env: Object.entries({ ...process.env, ...config.env }).reduce(
            (acc, [key, value]) => {
              if (value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, string>,
          ),
          cwd: process.cwd(),
        });

        await client.connect(transport);
      } else if (isMaybeSseConfig(this.serverConfig)) {
        const config = MCPSseConfigZodSchema.parse(this.serverConfig);
        const url = new URL(config.url);
        try {
          const transport = new StreamableHTTPClientTransport(url, {
            requestInit: {
              headers: config.headers,
            },
          });
          await client.connect(transport);
        } catch {
          this.log.info(
            "Streamable HTTP connection failed, falling back to SSE transport",
          );
          const transport = new SSEClientTransport(url, {
            requestInit: {
              headers: config.headers,
            },
          });
          await client.connect(transport);
        }
      } else {
        throw new Error("Invalid server config");
      }

      this.log.info(
        `Connected to MCP server in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
      );
      this.isConnected = true;
      this.error = undefined;
      this.client = client;
      const toolResponse = await client.listTools();
      this.toolInfo = toolResponse.tools.map(
        (tool) =>
          ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }) as MCPToolInfo,
      );

      // Create AI SDK tool wrappers for each MCP tool
      this.tools = toolResponse.tools.reduce((prev, _tool) => {
        const parameters = jsonSchema(
          toAny({
            ..._tool.inputSchema,
            properties: _tool.inputSchema.properties ?? {},
            additionalProperties: false,
          }),
        );
        prev[_tool.name] = tool({
          parameters,
          description: _tool.description,
          execute: (params, options: ToolExecutionOptions) => {
            options?.abortSignal?.throwIfAborted();
            return this.callTool(_tool.name, params);
          },
        });
        return prev;
      }, {});
      this.scheduleAutoDisconnect();
    } catch (error) {
      this.log.error(error);
      this.isConnected = false;
      this.error = error;
    }

    this.locker.unlock();
    return this.client;
  }
  async disconnect() {
    this.log.info("Disconnecting from MCP server");
    await this.locker.wait();
    this.isConnected = false;
    const client = this.client;
    this.client = undefined;
    await client?.close().catch((e) => this.log.error(e));
  }
  async callTool(toolName: string, input?: unknown) {
    return safe(() => this.log.info("tool call", toolName))

      .ifOk(() => {
        if (this.error) {
          throw new Error(
            "MCP Server is currently in an error state. Please check the configuration and try refreshing the server.",
          );
        }
      })
      .ifOk(() => this.scheduleAutoDisconnect()) // disconnect if autoDisconnectSeconds is set
      .map(async () => {
        const client = await this.connect();
        return client?.callTool({
          name: toolName,
          arguments: input as Record<string, unknown>,
        });
      })
      .ifOk((v) => {
        if (isNull(v)) {
          throw new Error("Tool call failed with null");
        }
        return v;
      })
      .ifOk(() => this.scheduleAutoDisconnect())
      .watch((status) => {
        if (!status.isOk) {
          this.log.error("Tool call failed", toolName, status.error);
        } else if (status.value?.isError) {
          this.log.error("Tool call failed", toolName, status.value.content);
        }
      })
      .ifFail((error) => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: {
                  message: errorToString(error),
                  name: error?.name,
                },
              }),
            },
          ],
          isError: true,
        };
      })
      .unwrap();
  }
}

import { createSimpleHttpClient, type SimpleHttpClient } from "./simple-http-client";
import type { SimpleHttpMCPConfig } from "app-types/mcp";

/**
 * Factory function to create a new MCP client
 */
export const createMCPClient = (
  name: string,
  serverConfig: MCPServerConfig, // This is now a discriminated union
  options: ClientOptions = {},
): MCPClient | SimpleHttpClient => { // Return type is now a union
  if (serverConfig.protocol === 'simple-http') {
    // serverConfig is already validated by Zod at the point of loading configurations,
    // so direct casting should be safe here if the discriminated union is set up correctly.
    return createSimpleHttpClient(name, serverConfig as SimpleHttpMCPConfig);
    // Note: 'options' (like autoDisconnectSeconds) is not passed to createSimpleHttpClient
    // as it doesn't currently use them.
  } else if (serverConfig.protocol === 'sse' || serverConfig.protocol === 'stdio') {
    // Existing logic to create and return the standard MCPClient
    return new MCPClient(name, serverConfig, options);
  } else {
    // This case should ideally not be reached if MCPServerConfig is correctly parsed
    // by a Zod schema that only allows known protocols.
    const unknownProtocol = (serverConfig as any)?.protocol;
    logger.error(`Unsupported MCP protocol: ${unknownProtocol} for MCP: ${name}`);
    throw new Error(`Unsupported MCP protocol: ${unknownProtocol}`);
  }
};

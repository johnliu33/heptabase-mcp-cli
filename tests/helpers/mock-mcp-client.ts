import type { McpClient } from '../../src/transport/mcp-client.js';

type ToolHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

interface CallLogEntry {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Mock McpClient for contract testing.
 * Implements the same interface as McpClient but uses in-memory handlers.
 */
export class MockMcpClient {
  private handlers = new Map<string, ToolHandler>();
  public callLog: CallLogEntry[] = [];

  onTool(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  async connect(): Promise<void> {
    // no-op
  }

  async disconnect(): Promise<void> {
    // no-op
  }

  async listTools() {
    return {
      tools: Array.from(this.handlers.keys()).map(name => ({ name })),
    };
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.callLog.push({ name, args });

    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`No mock handler for tool: ${name}`);
    }

    return handler(args);
  }

  clearLog(): void {
    this.callLog = [];
  }
}

/**
 * Create a MockMcpClient typed as McpClient for use in HeptabaseClient
 */
export function createMockMcpClient(): MockMcpClient {
  return new MockMcpClient();
}

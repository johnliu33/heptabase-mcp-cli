import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { TokenManager } from './token-manager.js';
import { HeptabaseOAuthProvider } from './oauth.js';
import { HeptabaseError } from '../types/common.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

const HEPTABASE_MCP_URL = 'https://api.heptabase.com/mcp';

export interface McpClientOptions {
  tokenManager: TokenManager;
  serverUrl?: string;
}

export class McpClient {
  private client: Client;
  private tokenManager: TokenManager;
  private authProvider: HeptabaseOAuthProvider;
  private serverUrl: string;
  private connected = false;

  constructor(options: McpClientOptions) {
    this.tokenManager = options.tokenManager;
    this.serverUrl = options.serverUrl ?? HEPTABASE_MCP_URL;
    this.authProvider = new HeptabaseOAuthProvider(this.tokenManager);
    this.client = new Client({
      name: 'heptabase-extension',
      version: '1.0.0',
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const url = new URL(this.serverUrl);

    try {
      // Try StreamableHTTP first
      const transport = new StreamableHTTPClientTransport(url, {
        authProvider: this.authProvider,
      });
      await this.client.connect(transport);
      this.connected = true;
      logger.info('MCP 連線成功 (StreamableHTTP)');
    } catch (streamableError) {
      logger.debug('StreamableHTTP 失敗，嘗試 SSE fallback...', streamableError);
      try {
        // Fallback to SSE
        this.client = new Client({
          name: 'heptabase-extension',
          version: '1.0.0',
        });
        const sseTransport = new SSEClientTransport(url, {
          authProvider: this.authProvider,
        });
        await this.client.connect(sseTransport);
        this.connected = true;
        logger.info('MCP 連線成功 (SSE)');
      } catch (sseError) {
        this.connected = false;
        throw HeptabaseError.networkError(
          `無法連接 Heptabase MCP Server: ${sseError instanceof Error ? sseError.message : String(sseError)}`
        );
      }
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.close();
    } catch {
      // ignore close errors
    }
    this.connected = false;
    logger.info('MCP 連線已斷開');
  }

  async listTools() {
    await this.ensureConnected();
    return await this.client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.ensureConnected();

    return withRetry(
      async () => {
        try {
          const result = await this.client.callTool({ name, arguments: args });
          return result;
        } catch (error) {
          this.classifyAndThrow(error);
        }
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        shouldRetry: (error) => {
          if (error instanceof HeptabaseError) {
            return error.retryable;
          }
          return false;
        },
      },
    );
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private classifyAndThrow(error: unknown): never {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      throw HeptabaseError.unauthorized();
    }
    if (statusCode === 429) {
      throw HeptabaseError.rateLimited();
    }
    if (statusCode !== undefined && statusCode >= 500) {
      throw HeptabaseError.serverError();
    }

    if (error instanceof Error) {
      if (error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
        throw HeptabaseError.networkError();
      }
      throw new HeptabaseError(error.message, 'UNKNOWN', undefined, false);
    }

    throw new HeptabaseError(String(error), 'UNKNOWN', undefined, false);
  }
}

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    if ('statusCode' in error) return (error as { statusCode: number }).statusCode;
    if ('status' in error) return (error as { status: number }).status;
  }
  return undefined;
}

export function createMcpClient(tokenManager: TokenManager): McpClient {
  return new McpClient({ tokenManager });
}

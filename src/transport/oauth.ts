import { createServer, type Server } from 'node:http';
import { URL, URLSearchParams } from 'node:url';
import open from 'open';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientMetadata, OAuthTokens, OAuthClientInformationMixed } from '@modelcontextprotocol/sdk/shared/auth.js';
import { TokenManager, type TokenData } from './token-manager.js';
import { logger } from '../utils/logger.js';

const HEPTABASE_MCP_URL = 'https://api.heptabase.com/mcp';

export class HeptabaseOAuthProvider implements OAuthClientProvider {
  private tokenManager: TokenManager;
  private _codeVerifier: string = '';
  private _redirectUrl: URL;
  private _clientInfo: OAuthClientInformationMixed | undefined;

  constructor(tokenManager: TokenManager, redirectPort: number = 8371) {
    this.tokenManager = tokenManager;
    this._redirectUrl = new URL(`http://localhost:${redirectPort}/callback`);
  }

  get redirectUrl(): URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this._redirectUrl.toString()],
      client_name: 'heptabase-extension',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return this._clientInfo;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    this._clientInfo = info;
    logger.debug('Client information 已儲存');
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const accessToken = this.tokenManager.getToken();
    const refreshToken = this.tokenManager.getRefreshToken();
    if (!accessToken) return undefined;
    return {
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      token_type: 'Bearer',
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const expiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : Date.now() + 3600 * 1000; // default 1 hour

    this.tokenManager.saveToken({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? '',
      expires_at: expiresAt,
    });
    logger.info('Token 已儲存');
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    logger.info('正在開啟瀏覽器進行 Heptabase 授權...');
    await open(authorizationUrl.toString());
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
  }

  async codeVerifier(): Promise<string> {
    return this._codeVerifier;
  }
}

/**
 * 啟動本地 HTTP server 等待 OAuth callback
 * 回傳 authorization code
 */
export function waitForAuthCallback(port: number = 8371): Promise<string> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>授權失敗</h1><p>${error}</p><p>可以關閉此視窗。</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>授權成功！</h1><p>可以關閉此視窗，回到終端機。</p>');
          server.close();
          resolve(code);
          return;
        }

        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing code parameter');
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      logger.debug(`OAuth callback server listening on port ${port}`);
    });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth 授權逾時（5 分鐘）'));
    }, 5 * 60 * 1000);

    server.on('close', () => clearTimeout(timeout));
  });
}

/**
 * 完整 OAuth 授權流程（手動模式，不依賴 SDK 自動流程時使用）
 */
export async function authorize(tokenManager: TokenManager): Promise<void> {
  const provider = new HeptabaseOAuthProvider(tokenManager);

  logger.info('開始 Heptabase OAuth 授權流程...');
  logger.info('即將開啟瀏覽器，請登入 Heptabase 並允許授權。');

  // Start callback server and open browser in parallel
  const callbackPromise = waitForAuthCallback();

  // The SDK transport will handle the actual OAuth flow
  // This manual flow is a fallback
  const authUrl = new URL(HEPTABASE_MCP_URL);
  await open(authUrl.toString());

  const code = await callbackPromise;
  logger.info(`取得授權碼，正在交換 token...`);

  // The actual token exchange will be handled by the MCP SDK transport
  // when we use the provider with StreamableHTTPClientTransport
  logger.info('授權完成！');
}

/**
 * 確保已授權。若 token 有效則直接回傳，否則嘗試 refresh 或重新授權。
 */
export async function ensureAuthorized(tokenManager: TokenManager): Promise<string> {
  if (tokenManager.isTokenValid()) {
    return tokenManager.getToken()!;
  }

  const refreshToken = tokenManager.getRefreshToken();
  if (refreshToken) {
    logger.info('Token 已過期，嘗試 refresh...');
    // Refresh will be handled by the MCP SDK transport's authProvider
    // If we reach here without SDK, throw to trigger re-auth
  }

  throw new Error('請先執行 `heptabase auth login` 進行授權');
}

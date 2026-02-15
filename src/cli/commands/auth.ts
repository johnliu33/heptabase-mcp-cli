import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { HeptabaseOAuthProvider, waitForAuthCallback } from '../../transport/oauth.js';
import { McpClient } from '../../transport/mcp-client.js';
import { logger } from '../../utils/logger.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('管理 Heptabase 認證');

  auth
    .command('login')
    .description('登入 Heptabase（OAuth 授權）')
    .action(async () => {
      const tokenManager = new TokenManager();

      if (tokenManager.isTokenValid()) {
        console.log('已經登入。如需重新授權，請先執行 `heptabase auth logout`。');
        return;
      }

      console.log('開始 OAuth 授權流程...');
      console.log('即將開啟瀏覽器，請登入 Heptabase 並允許授權。');

      try {
        // Use MCP SDK's built-in OAuth flow via transport
        const mcpClient = new McpClient({ tokenManager });
        await mcpClient.connect();
        console.log('授權成功！');
        await mcpClient.disconnect();
      } catch (error) {
        if (error instanceof Error && error.message.includes('授權')) {
          // OAuth flow initiated by SDK — wait for callback
          try {
            const code = await waitForAuthCallback();
            logger.info(`取得授權碼: ${code.slice(0, 8)}...`);
            console.log('授權成功！Token 已儲存。');
          } catch (callbackError) {
            console.error('授權失敗：', callbackError instanceof Error ? callbackError.message : callbackError);
            process.exit(1);
          }
        } else {
          console.error('連線失敗：', error instanceof Error ? error.message : error);
          process.exit(1);
        }
      }
    });

  auth
    .command('status')
    .description('顯示目前的認證狀態')
    .action(() => {
      const tokenManager = new TokenManager();
      const status = tokenManager.getStatus();

      if (!status.hasToken) {
        console.log('尚未登入。請執行 `heptabase auth login`。');
        return;
      }

      console.log(`已登入`);
      console.log(`Token 有效：${status.isValid ? '是' : '否（已過期）'}`);
      if (status.expiresAt) {
        console.log(`過期時間：${status.expiresAt.toLocaleString()}`);
      }
    });

  auth
    .command('logout')
    .description('登出（清除本地 Token）')
    .action(() => {
      const tokenManager = new TokenManager();
      tokenManager.clearToken();
      console.log('已登出，Token 已清除。');
    });

  return auth;
}

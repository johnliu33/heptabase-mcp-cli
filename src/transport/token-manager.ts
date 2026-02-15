import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in ms
}

const TOKEN_DIR = join(homedir(), '.heptabase-extension');
const TOKEN_FILE = join(TOKEN_DIR, 'token.json');
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes early

export class TokenManager {
  private tokenData: TokenData | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(TOKEN_FILE)) {
        const raw = readFileSync(TOKEN_FILE, 'utf-8');
        this.tokenData = JSON.parse(raw) as TokenData;
      }
    } catch {
      this.tokenData = null;
    }
  }

  saveToken(data: TokenData): void {
    if (!existsSync(TOKEN_DIR)) {
      mkdirSync(TOKEN_DIR, { recursive: true });
    }
    writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf-8');
    chmodSync(TOKEN_FILE, 0o600);
    this.tokenData = data;
  }

  getToken(): string | null {
    if (!this.tokenData) return null;
    return this.tokenData.access_token;
  }

  getRefreshToken(): string | null {
    if (!this.tokenData) return null;
    return this.tokenData.refresh_token;
  }

  isTokenValid(): boolean {
    if (!this.tokenData) return false;
    return Date.now() < this.tokenData.expires_at - EXPIRY_BUFFER_MS;
  }

  clearToken(): void {
    this.tokenData = null;
    try {
      if (existsSync(TOKEN_FILE)) {
        writeFileSync(TOKEN_FILE, '{}', 'utf-8');
      }
    } catch {
      // ignore
    }
  }

  getStatus(): { hasToken: boolean; isValid: boolean; expiresAt: Date | null } {
    return {
      hasToken: this.tokenData !== null && !!this.tokenData.access_token,
      isValid: this.isTokenValid(),
      expiresAt: this.tokenData?.expires_at
        ? new Date(this.tokenData.expires_at)
        : null,
    };
  }
}

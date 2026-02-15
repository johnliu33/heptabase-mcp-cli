export interface HeptabaseConfig {
  cache_ttl: number;
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_CONFIG: HeptabaseConfig = {
  cache_ttl: 300,
  log_level: 'info',
};

export class HeptabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'HeptabaseError';
  }

  static unauthorized(message = '認證已過期，請重新授權'): HeptabaseError {
    return new HeptabaseError(message, 'UNAUTHORIZED', 401, false);
  }

  static rateLimited(message = '請求過於頻繁，稍後重試'): HeptabaseError {
    return new HeptabaseError(message, 'RATE_LIMITED', 429, true);
  }

  static serverError(message = '伺服器錯誤'): HeptabaseError {
    return new HeptabaseError(message, 'SERVER_ERROR', 500, true);
  }

  static networkError(message = '網路連線失敗，請檢查網路'): HeptabaseError {
    return new HeptabaseError(message, 'NETWORK_ERROR', undefined, true);
  }
}

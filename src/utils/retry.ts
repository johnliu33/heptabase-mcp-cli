export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status;
  }
  return undefined;
}

function defaultShouldRetry(error: unknown): boolean {
  const status = getStatusCode(error);
  if (status === 401) return false;
  if (status === 429) return true;
  if (status !== undefined && status >= 500) return true;
  if (error instanceof TypeError && (error as Error).message?.includes('fetch')) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // 指數退避 + 隨機 jitter（避免 thundering herd）
      const jitter = 0.5 + Math.random() * 0.5; // 0.5 ~ 1.0
      const delay = baseDelay * Math.pow(2, attempt) * jitter;
      console.debug(
        `[DEBUG] retry attempt ${attempt + 1}/${maxRetries}, delay=${Math.round(delay)}ms`,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

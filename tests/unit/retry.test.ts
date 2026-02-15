import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 429 })
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on 5xx and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 503 })
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should NOT retry on 401', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 401 });

    await expect(withRetry(fn, { baseDelay: 1 })).rejects.toEqual({ statusCode: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after maxRetries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 500 });

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1 })).rejects.toEqual({ statusCode: 500 });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should support custom shouldRetry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('custom-retryable'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      baseDelay: 1,
      shouldRetry: (err) => err instanceof Error && err.message === 'custom-retryable',
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, { baseDelay: 50, maxRetries: 3 });
    const elapsed = Date.now() - start;

    // baseDelay=50: first retry ~50ms, second retry ~100ms, total ~150ms
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should handle status field as well as statusCode', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401 });

    await expect(withRetry(fn, { baseDelay: 1 })).rejects.toEqual({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

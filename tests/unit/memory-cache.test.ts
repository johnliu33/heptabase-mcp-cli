import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryCache } from '../../src/cache/memory-cache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  it('should set and get a value', () => {
    cache.set('key1', { data: 'hello' });
    expect(cache.get('key1')).toEqual({ data: 'hello' });
  });

  it('should return undefined for missing key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should return undefined for expired entry', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value', 1); // 1 second TTL

    vi.advanceTimersByTime(1500); // 1.5 seconds later
    expect(cache.get('key1')).toBeUndefined();

    vi.useRealTimers();
  });

  it('should return value before expiry', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value', 10); // 10 second TTL

    vi.advanceTimersByTime(5000); // 5 seconds later
    expect(cache.get('key1')).toBe('value');

    vi.useRealTimers();
  });

  it('should invalidate by prefix', () => {
    cache.set('search:mcp', 'result1');
    cache.set('search:heptabase', 'result2');
    cache.set('whiteboard:wb-1', 'result3');

    cache.invalidate('search:');

    expect(cache.get('search:mcp')).toBeUndefined();
    expect(cache.get('search:heptabase')).toBeUndefined();
    expect(cache.get('whiteboard:wb-1')).toBe('result3');
  });

  it('should clear all entries', () => {
    cache.set('key1', 'v1');
    cache.set('key2', 'v2');
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should build consistent cache keys', () => {
    const key1 = cache.buildKey('semantic_search', { query: 'MCP' });
    const key2 = cache.buildKey('semantic_search', { query: 'MCP' });
    expect(key1).toBe(key2);
    expect(key1).toBe('semantic_search:{"query":"MCP"}');
  });

  it('should return shorter TTL for search tools', () => {
    expect(cache.getTtlForTool('semantic_search_objects')).toBe(60);
    expect(cache.getTtlForTool('get_object')).toBe(300);
    expect(cache.getTtlForTool('get_whiteboard_with_objects')).toBe(300);
  });

  it('should overwrite existing entries', () => {
    cache.set('key1', 'old');
    cache.set('key1', 'new');
    expect(cache.get('key1')).toBe('new');
  });

  it('should clean up expired entries on get', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value', 1);

    vi.advanceTimersByTime(1500);
    cache.get('key1'); // triggers cleanup

    // The entry should be removed from the store
    expect(cache.size).toBe(0);

    vi.useRealTimers();
  });
});

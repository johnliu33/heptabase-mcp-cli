import { describe, it, expect } from 'vitest';
import { splitDateRange, diffDays } from '../../src/utils/date-range.js';

describe('diffDays', () => {
  it('應計算正確的天數差', () => {
    expect(diffDays('2024-01-01', '2024-01-10')).toBe(9);
  });

  it('同一天應回傳 0', () => {
    expect(diffDays('2024-06-15', '2024-06-15')).toBe(0);
  });

  it('跨月應正確計算', () => {
    expect(diffDays('2024-01-15', '2024-03-15')).toBe(60);
  });
});

describe('splitDateRange', () => {
  it('≤90 天應回傳單一 chunk', () => {
    const chunks = splitDateRange('2024-01-01', '2024-03-31'); // 90 天
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ startDate: '2024-01-01', endDate: '2024-03-31' });
  });

  it('>90 天應分割為多個 chunk', () => {
    const chunks = splitDateRange('2024-01-01', '2024-06-30'); // 181 天
    expect(chunks.length).toBeGreaterThan(1);

    // 每個 chunk ≤ 90 天
    for (const chunk of chunks) {
      expect(diffDays(chunk.startDate, chunk.endDate)).toBeLessThanOrEqual(90);
    }
  });

  it('chunk 之間應連續不重疊', () => {
    const chunks = splitDateRange('2024-01-01', '2024-12-31');

    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = new Date(chunks[i - 1].endDate);
      const currStart = new Date(chunks[i].startDate);
      const gap = (currStart.getTime() - prevEnd.getTime()) / 86400000;
      expect(gap).toBe(1); // 隔天開始
    }
  });

  it('分割後應涵蓋完整範圍', () => {
    const chunks = splitDateRange('2024-01-01', '2024-12-31');
    expect(chunks[0].startDate).toBe('2024-01-01');
    expect(chunks[chunks.length - 1].endDate).toBe('2024-12-31');
  });

  it('同一天應回傳單一 chunk', () => {
    const chunks = splitDateRange('2024-06-15', '2024-06-15');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ startDate: '2024-06-15', endDate: '2024-06-15' });
  });

  it('自訂 maxDays 應正確分割', () => {
    const chunks = splitDateRange('2024-01-01', '2024-01-31', 10);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(diffDays(chunk.startDate, chunk.endDate)).toBeLessThanOrEqual(10);
    }
  });
});

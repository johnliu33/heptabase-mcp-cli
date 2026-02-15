export interface DateChunk {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

const MS_PER_DAY = 86400000;
const MAX_CHUNK_DAYS = 90;

/**
 * 計算兩個日期之間的天數差
 */
export function diffDays(startDate: string, endDate: string): number {
  return Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / MS_PER_DAY,
  );
}

/**
 * 將日期範圍分割為多個 chunk，每個 chunk 最多 maxDays 天。
 * chunk 之間連續不重疊。
 */
export function splitDateRange(
  startDate: string,
  endDate: string,
  maxDays: number = MAX_CHUNK_DAYS,
): DateChunk[] {
  const totalDays = diffDays(startDate, endDate);
  if (totalDays <= maxDays) {
    return [{ startDate, endDate }];
  }

  const chunks: DateChunk[] = [];
  let currentStart = new Date(startDate);
  const end = new Date(endDate);

  while (currentStart <= end) {
    const chunkEnd = new Date(currentStart);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays);

    const actualEnd = chunkEnd > end ? end : chunkEnd;

    chunks.push({
      startDate: formatDate(currentStart),
      endDate: formatDate(actualEnd),
    });

    // 下一個 chunk 從 actualEnd 的隔天開始
    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

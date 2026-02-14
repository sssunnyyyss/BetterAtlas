type BaseBlock = {
  day: string;
  startMin: number;
  endMin: number;
};

export type LaidOutBlock<T extends BaseBlock> = T & { col: number; colCount: number };

export function layoutOverlaps<T extends BaseBlock>(blocks: T[]): LaidOutBlock<T>[] {
  const byDay = new Map<string, T[]>();
  for (const b of blocks) {
    if (!byDay.has(b.day)) byDay.set(b.day, []);
    byDay.get(b.day)!.push(b);
  }

  const out: LaidOutBlock<T>[] = [];
  for (const [_day, dayBlocks] of byDay.entries()) {
    const laid = layoutDayNew(dayBlocks);
    out.push(...laid);
  }
  return out;
}

function layoutDayNew<T extends BaseBlock>(blocks: T[]): LaidOutBlock<T>[] {
  const sorted = [...blocks].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.endMin !== b.endMin) return a.endMin - b.endMin;
    return 0;
  });

  type Active = { idx: number; endMin: number; col: number };
  let active: Active[] = [];
  let freeCols: number[] = [];
  let nextCol = 0;

  let clusterIdxs: number[] = [];
  let clusterMaxConcurrent = 1;
  const out: LaidOutBlock<T>[] = sorted.map((b) => ({ ...(b as any), col: 0, colCount: 1 }));

  function releaseEnded(startMin: number) {
    const still: Active[] = [];
    for (const a of active) {
      if (a.endMin <= startMin) freeCols.push(a.col);
      else still.push(a);
    }
    active = still;
    freeCols.sort((x, y) => x - y);
  }

  function flushCluster() {
    for (const idx of clusterIdxs) out[idx].colCount = clusterMaxConcurrent;
    clusterIdxs = [];
    clusterMaxConcurrent = 1;
    active = [];
    freeCols = [];
    nextCol = 0;
  }

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    releaseEnded(b.startMin);
    if (active.length === 0 && clusterIdxs.length > 0) flushCluster();

    const col = freeCols.length > 0 ? freeCols.shift()! : nextCol++;
    out[i].col = col;
    active.push({ idx: i, endMin: b.endMin, col });
    clusterIdxs.push(i);
    if (active.length > clusterMaxConcurrent) clusterMaxConcurrent = active.length;
  }

  if (clusterIdxs.length > 0) flushCluster();
  return out;
}

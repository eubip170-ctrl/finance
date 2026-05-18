/**
 * Tiny k-means++ for clustering normalized embeddings.
 * Deterministic-ish (seeded), single-threaded, fine up to ~5k vectors.
 *
 * Returns the cluster index for each input vector and the cluster centroids.
 */

export type KMeansResult = {
  assignments: number[];
  centroids: number[][];
  inertia: number;
};

function rand(seed: { v: number }): number {
  // mulberry32
  let t = (seed.v += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function plusPlusInit(vectors: number[][], k: number, seed: { v: number }): number[][] {
  const n = vectors.length;
  const first = Math.floor(rand(seed) * n);
  const centers: number[][] = [vectors[first].slice()];
  const closest = new Float64Array(n);
  for (let i = 0; i < n; i++) closest[i] = sqDist(vectors[i], centers[0]);

  while (centers.length < k) {
    let total = 0;
    for (let i = 0; i < n; i++) total += closest[i];
    let r = rand(seed) * total;
    let picked = n - 1;
    for (let i = 0; i < n; i++) {
      r -= closest[i];
      if (r <= 0) {
        picked = i;
        break;
      }
    }
    centers.push(vectors[picked].slice());
    for (let i = 0; i < n; i++) {
      const d = sqDist(vectors[i], centers[centers.length - 1]);
      if (d < closest[i]) closest[i] = d;
    }
  }
  return centers;
}

export function kmeans(
  vectors: number[][],
  k: number,
  opts: { maxIter?: number; seed?: number } = {},
): KMeansResult {
  const maxIter = opts.maxIter ?? 50;
  const n = vectors.length;
  if (n === 0) return { assignments: [], centroids: [], inertia: 0 };
  const realK = Math.min(k, n);
  const dim = vectors[0].length;

  const seed = { v: opts.seed ?? 42 };
  let centroids = plusPlusInit(vectors, realK, seed);
  const assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < realK; c++) {
        const d = sqDist(vectors[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    const sums: number[][] = Array.from({ length: realK }, () => new Array(dim).fill(0));
    const counts = new Array(realK).fill(0);
    for (let i = 0; i < n; i++) {
      const a = assignments[i];
      counts[a]++;
      const v = vectors[i];
      const s = sums[a];
      for (let j = 0; j < dim; j++) s[j] += v[j];
    }
    const newCentroids: number[][] = [];
    for (let c = 0; c < realK; c++) {
      if (counts[c] === 0) {
        newCentroids.push(centroids[c]);
      } else {
        const avg = new Array(dim);
        for (let j = 0; j < dim; j++) avg[j] = sums[c][j] / counts[c];
        newCentroids.push(avg);
      }
    }
    centroids = newCentroids;
    if (!changed) break;
  }

  let inertia = 0;
  for (let i = 0; i < n; i++) inertia += sqDist(vectors[i], centroids[assignments[i]]);

  return { assignments, centroids, inertia };
}

/**
 * Pick a sensible k via a cheap elbow rule. Returns the best k in [kMin..kMax].
 */
export function chooseK(vectors: number[][], kMin = 3, kMax = 8): number {
  if (vectors.length < kMin * 2) return Math.max(2, Math.min(kMin, vectors.length));
  const results: Array<{ k: number; inertia: number }> = [];
  for (let k = kMin; k <= Math.min(kMax, vectors.length - 1); k++) {
    const r = kmeans(vectors, k, { maxIter: 20, seed: 7 });
    results.push({ k, inertia: r.inertia });
  }
  // Knee heuristic: pick k where inertia drop flattens.
  let bestK = results[0].k;
  let bestRatio = -Infinity;
  for (let i = 1; i < results.length - 1; i++) {
    const prev = results[i - 1].inertia;
    const cur = results[i].inertia;
    const next = results[i + 1].inertia;
    const drop = prev - cur;
    const nextDrop = cur - next;
    const ratio = drop - nextDrop;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestK = results[i].k;
    }
  }
  return bestK;
}

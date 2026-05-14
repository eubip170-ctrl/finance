/**
 * Tiny PCA for high-dim embedding vectors.
 *
 * We use power iteration with deflation to extract the top-k principal
 * components without pulling in a numerics library. Good enough for the
 * brain viz where we only need the first 3 components and ~2k samples.
 *
 * Inputs are expected to be already L2-normalised (OpenAI embeddings are) so
 * we don't apply standardisation — only mean-centering.
 */

const POWER_ITER = 60;
const EPS = 1e-9;

export type Pca3 = {
  components: number[][]; // [3][dim] axes
  mean: number[]; // centroid
  projections: number[][]; // [N][3]
};

export function pca3(vectors: number[][]): Pca3 {
  const n = vectors.length;
  if (n === 0) return { components: [[], [], []], mean: [], projections: [] };
  const dim = vectors[0].length;

  // 1) Mean-centre the data.
  const mean = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let j = 0; j < dim; j++) mean[j] += v[j];
  }
  for (let j = 0; j < dim; j++) mean[j] /= n;

  // Work on a centred copy so deflation can mutate it safely.
  const X: number[][] = vectors.map((v) => v.map((x, j) => x - mean[j]));

  const components: number[][] = [];
  for (let k = 0; k < 3; k++) {
    const comp = topComponent(X, dim);
    components.push(comp);
    deflate(X, comp);
  }

  // Project the original centred matrix onto the discovered components.
  const projections: number[][] = vectors.map((v) => {
    const c = v.map((x, j) => x - mean[j]);
    return components.map((axis) => dot(c, axis));
  });

  return { components, mean, projections };
}

/** Top eigenvector via power iteration on X^T X (covariance up to scale). */
function topComponent(X: number[][], dim: number): number[] {
  // Seed with a stable but data-dependent vector to avoid degenerate starts.
  let v = new Array<number>(dim);
  for (let j = 0; j < dim; j++) v[j] = ((j * 9301 + 49297) % 233280) / 233280 - 0.5;
  v = normalise(v);

  for (let iter = 0; iter < POWER_ITER; iter++) {
    // u = X * v (length N)
    const u = new Array<number>(X.length);
    for (let i = 0; i < X.length; i++) u[i] = dot(X[i], v);
    // w = X^T * u (length dim)
    const w = new Array<number>(dim).fill(0);
    for (let i = 0; i < X.length; i++) {
      const ui = u[i];
      const row = X[i];
      for (let j = 0; j < dim; j++) w[j] += ui * row[j];
    }
    const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    if (norm < EPS) break;
    let delta = 0;
    for (let j = 0; j < dim; j++) {
      const next = w[j] / norm;
      delta += Math.abs(next - v[j]);
      v[j] = next;
    }
    if (delta < 1e-6) break;
  }
  return v;
}

/** Subtract the component's contribution from every row of X (in place). */
function deflate(X: number[][], axis: number[]) {
  for (let i = 0; i < X.length; i++) {
    const p = dot(X[i], axis);
    const row = X[i];
    for (let j = 0; j < row.length; j++) row[j] -= p * axis[j];
  }
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalise(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (n < EPS) return v.slice();
  return v.map((x) => x / n);
}

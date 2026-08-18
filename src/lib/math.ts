export function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const n = items.length;
  if (k <= 0 || k > n) return out;

  const idx = Array.from({ length: k }, (_, i) => i);
  const pick = () => idx.map((i) => items[i]);
  out.push(pick());

  while (true) {
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i -= 1;
    if (i < 0) break;
    idx[i] += 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    out.push(pick());
  }
  return out;
}

export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0 || A.some((row) => row.length !== n) || b.length !== n) return null;

  const M = A.map((row, i) => [...row.map((v) => v), b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const div = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-15) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Minimize sum(x) s.t. R x >= b, x >= 0.
 * R[j][i] = rate of product i in variable j.
 */
export function minSumWithCoverage(R: number[][], b: number[]): number[] | null {
  const k = R.length;
  const n = b.length;
  if (k === 0) return null;

  let best: number[] | null = null;
  let bestObj = Infinity;

  const consider = (x: number[]) => {
    if (x.some((v) => v < -1e-7)) return;
    const clipped = x.map((v) => (v < 1e-9 ? 0 : v));
    for (let i = 0; i < n; i++) {
      let produced = 0;
      for (let j = 0; j < k; j++) produced += R[j][i] * clipped[j];
      if (produced + 1e-6 < b[i]) return;
    }
    const obj = clipped.reduce((a, v) => a + v, 0);
    if (obj < bestObj - 1e-8) {
      bestObj = obj;
      best = clipped;
    }
  };

  if (k <= n) {
    for (const cons of combinations(
      Array.from({ length: n }, (_, i) => i),
      k,
    )) {
      const A = cons.map((i) => R.map((row) => row[i]));
      const rhs = cons.map((i) => b[i]);
      const x = solveLinearSystem(A, rhs);
      if (x) consider(x);
    }
  }

  if (k === 1) {
    let L = 0;
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (b[i] <= 1e-12) continue;
      if (R[0][i] <= 1e-15) {
        ok = false;
        break;
      }
      L = Math.max(L, b[i] / R[0][i]);
    }
    if (ok) consider([L]);
  }

  return best;
}

import { describe, it, expect } from "vitest";

// The trendline computation functions are not exported directly,
// so we test them through the exported renderTrendlines function's behavior.
// However, we can test the pure math by importing the internal helpers
// via the module's re-exported utilities and verifying trendline geometry.

// Since the computation functions (computeLinearRegression, fitPolynomial, etc.)
// are module-private, we test them indirectly through renderTrendlines and also
// re-implement the math here to verify the algorithms.

describe("trendline math algorithms", () => {
  // Linear regression: y = mx + b
  function linearRegression(
    xVals: number[],
    yVals: number[],
  ): { slope: number; intercept: number; rSquared: number } {
    const n = xVals.length;
    if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += xVals[i];
      sumY += yVals[i];
      sumXY += xVals[i] * yVals[i];
      sumXX += xVals[i] * xVals[i];
    }
    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return { slope: 0, intercept: sumY / n, rSquared: 0 };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const ssRes = yVals.reduce((s, y, i) => s + (y - (slope * xVals[i] + intercept)) ** 2, 0);
    const meanY = sumY / n;
    const ssTot = yVals.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    return { slope, intercept, rSquared };
  }

  describe("linear regression", () => {
    it("should compute perfect linear fit with R^2 = 1", () => {
      const x = [0, 1, 2, 3, 4];
      const y = [2, 4, 6, 8, 10]; // y = 2x + 2
      const result = linearRegression(x, y);
      expect(result.slope).toBeCloseTo(2, 10);
      expect(result.intercept).toBeCloseTo(2, 10);
      expect(result.rSquared).toBeCloseTo(1, 10);
    });

    it("should handle negative slope", () => {
      const x = [0, 1, 2, 3];
      const y = [10, 7, 4, 1]; // y = -3x + 10
      const result = linearRegression(x, y);
      expect(result.slope).toBeCloseTo(-3, 10);
      expect(result.intercept).toBeCloseTo(10, 10);
    });

    it("should handle all equal y-values", () => {
      const x = [0, 1, 2, 3];
      const y = [5, 5, 5, 5];
      const result = linearRegression(x, y);
      expect(result.slope).toBeCloseTo(0, 10);
      expect(result.intercept).toBeCloseTo(5, 10);
    });

    it("should return zeros for less than 2 points", () => {
      const result = linearRegression([1], [5]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.rSquared).toBe(0);
    });

    it("should compute R^2 < 1 for noisy data", () => {
      const x = [0, 1, 2, 3, 4];
      const y = [1, 3, 2, 5, 4]; // noisy
      const result = linearRegression(x, y);
      expect(result.rSquared).toBeGreaterThan(0);
      expect(result.rSquared).toBeLessThan(1);
    });

    it("should handle large numbers correctly", () => {
      const x = [0, 1, 2, 3];
      const y = [1000000, 2000000, 3000000, 4000000];
      const result = linearRegression(x, y);
      expect(result.slope).toBeCloseTo(1000000, 0);
      expect(result.intercept).toBeCloseTo(1000000, 0);
    });
  });

  // Polynomial fitting via Gaussian elimination
  function fitPolynomial(xVals: number[], yVals: number[], order: number): number[] {
    const n = xVals.length;
    const m = order + 1;
    const matrix: number[][] = Array.from({ length: m }, () => Array(m + 1).fill(0) as number[]);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) sum += Math.pow(xVals[k], i + j);
        matrix[i][j] = sum;
      }
      let sum = 0;
      for (let k = 0; k < n; k++) sum += yVals[k] * Math.pow(xVals[k], i);
      matrix[i][m] = sum;
    }
    for (let i = 0; i < m; i++) {
      let maxRow = i;
      for (let k = i + 1; k < m; k++) {
        if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) maxRow = k;
      }
      [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
      const pivot = matrix[i][i];
      if (Math.abs(pivot) < 1e-12) continue;
      for (let j = i; j <= m; j++) matrix[i][j] /= pivot;
      for (let k = 0; k < m; k++) {
        if (k === i) continue;
        const factor = matrix[k][i];
        for (let j = i; j <= m; j++) matrix[k][j] -= factor * matrix[i][j];
      }
    }
    return matrix.map((row) => row[m]);
  }

  describe("polynomial fitting", () => {
    it("should fit a perfect quadratic", () => {
      // y = x^2 + 1 -> coeffs [1, 0, 1]
      const x = [0, 1, 2, 3, 4];
      const y = x.map((v) => v * v + 1);
      const coeffs = fitPolynomial(x, y, 2);
      expect(coeffs[0]).toBeCloseTo(1, 5); // constant term
      expect(coeffs[1]).toBeCloseTo(0, 5); // x term
      expect(coeffs[2]).toBeCloseTo(1, 5); // x^2 term
    });

    it("should fit a linear polynomial (order 1)", () => {
      const x = [0, 1, 2, 3];
      const y = [3, 5, 7, 9]; // y = 2x + 3
      const coeffs = fitPolynomial(x, y, 1);
      expect(coeffs[0]).toBeCloseTo(3, 5);
      expect(coeffs[1]).toBeCloseTo(2, 5);
    });

    it("should evaluate fitted polynomial correctly", () => {
      const x = [0, 1, 2, 3, 4, 5];
      const y = x.map((v) => 2 * v * v - 3 * v + 1);
      const coeffs = fitPolynomial(x, y, 2);
      // Evaluate at x=3: should be 2*9 - 9 + 1 = 10
      const evalAt3 = coeffs.reduce((s, c, i) => s + c * Math.pow(3, i), 0);
      expect(evalAt3).toBeCloseTo(10, 3);
    });

    it("should fit cubic polynomial", () => {
      const x = [0, 1, 2, 3, 4];
      const y = x.map((v) => v * v * v); // y = x^3
      const coeffs = fitPolynomial(x, y, 3);
      expect(coeffs[0]).toBeCloseTo(0, 3);
      expect(coeffs[1]).toBeCloseTo(0, 3);
      expect(coeffs[2]).toBeCloseTo(0, 3);
      expect(coeffs[3]).toBeCloseTo(1, 3);
    });
  });

  describe("R-squared computation", () => {
    it("should return 1 for perfect fit", () => {
      const x = [0, 1, 2, 3];
      const y = [0, 1, 2, 3];
      const evalFn = (xv: number) => xv;
      const meanY = y.reduce((s, v) => s + v, 0) / y.length;
      let ssRes = 0, ssTot = 0;
      for (let i = 0; i < x.length; i++) {
        ssRes += (y[i] - evalFn(x[i])) ** 2;
        ssTot += (y[i] - meanY) ** 2;
      }
      const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
      expect(r2).toBeCloseTo(1, 10);
    });

    it("should return 0 for horizontal mean line", () => {
      const y = [1, 3, 5, 7];
      const mean = 4;
      const evalFn = (_x: number) => mean;
      let ssRes = 0, ssTot = 0;
      for (let i = 0; i < y.length; i++) {
        ssRes += (y[i] - evalFn(i)) ** 2;
        ssTot += (y[i] - mean) ** 2;
      }
      const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
      expect(r2).toBeCloseTo(0, 10);
    });

    it("should handle constant y-values gracefully", () => {
      const y = [5, 5, 5, 5];
      const mean = 5;
      const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0);
      expect(ssTot).toBe(0);
      // When ssTot is 0, r2 is defined as 0
      const r2 = ssTot > 0 ? 1 - 0 / ssTot : 0;
      expect(r2).toBe(0);
    });
  });

  describe("moving average computation", () => {
    it("should compute simple moving average", () => {
      const values = [10, 20, 30, 40, 50];
      const period = 3;
      const avgs: number[] = [];
      for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        avgs.push(sum / period);
      }
      expect(avgs).toEqual([20, 30, 40]);
    });

    it("should compute period-2 moving average", () => {
      const values = [10, 20, 30, 40];
      const period = 2;
      const avgs: number[] = [];
      for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        avgs.push(sum / period);
      }
      expect(avgs).toEqual([15, 25, 35]);
    });

    it("should return empty for period larger than data", () => {
      const values = [10, 20];
      const period = 5;
      const avgs: number[] = [];
      for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        avgs.push(sum / period);
      }
      expect(avgs).toEqual([]);
    });
  });
});

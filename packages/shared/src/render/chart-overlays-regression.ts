/**
 * chart-overlays-regression.ts: least-squares regression / polynomial-fit
 * math for chart trendlines. Split out of chart-overlays.ts to keep that
 * module under the repo's file-size guideline.
 *
 * Ported / adapted from:
 *   packages/react/src/viewer/utils/chart-trendlines.tsx (regression engine)
 *   packages/shared/src/render/chart-trendlines.ts (shared port)
 *
 * @module chart-overlays-regression
 */

/** Result of an ordinary least-squares linear regression. */
export interface LinearFit {
	slope: number;
	intercept: number;
	rSquared: number;
}

/**
 * Ordinary least-squares linear regression of `yVals` on `xVals`.
 * Returns slope=0, intercept=mean(y), rSquared=0 when fewer than 2 points or
 * when the denominator is effectively zero (vertical / constant-x data).
 *
 * Mirrors `computeLinearRegression` in chart-trendlines.tsx (React) and
 * chart-trendlines.ts (shared).
 */
export function computeLinearRegression(xVals: number[], yVals: number[]): LinearFit {
	const n = xVals.length;
	if (n < 2) {
		return { slope: 0, intercept: 0, rSquared: 0 };
	}

	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;
	for (let i = 0; i < n; i++) {
		sumX += xVals[i];
		sumY += yVals[i];
		sumXY += xVals[i] * yVals[i];
		sumXX += xVals[i] * xVals[i];
	}

	const denom = n * sumXX - sumX * sumX;
	if (Math.abs(denom) < 1e-12) {
		return { slope: 0, intercept: sumY / n, rSquared: 0 };
	}

	const slope = (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;

	const ssRes = yVals.reduce((s, y, i) => s + (y - (slope * xVals[i] + intercept)) ** 2, 0);
	const meanY = sumY / n;
	const ssTot = yVals.reduce((s, y) => s + (y - meanY) ** 2, 0);
	const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

	return { slope, intercept, rSquared };
}

/**
 * Fit polynomial coefficients (ascending order: [a0, a1, ..., a_order]) via
 * Gaussian elimination on the normal equations.
 * Mirrors `fitPolynomial` in chart-trendlines.tsx (React).
 */
export function fitPolynomial(xVals: number[], yVals: number[], order: number): number[] {
	const n = xVals.length;
	const m = order + 1;
	const matrix: number[][] = Array.from({ length: m }, () => Array(m + 1).fill(0) as number[]);

	for (let i = 0; i < m; i++) {
		for (let j = 0; j < m; j++) {
			let sum = 0;
			for (let k = 0; k < n; k++) {
				sum += xVals[k] ** (i + j);
			}
			matrix[i][j] = sum;
		}
		let sum = 0;
		for (let k = 0; k < n; k++) {
			sum += yVals[k] * xVals[k] ** i;
		}
		matrix[i][m] = sum;
	}

	for (let i = 0; i < m; i++) {
		let maxRow = i;
		for (let k = i + 1; k < m; k++) {
			if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
				maxRow = k;
			}
		}
		[matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
		const pivot = matrix[i][i];
		if (Math.abs(pivot) < 1e-12) {
			continue;
		}
		for (let j = i; j <= m; j++) {
			matrix[i][j] /= pivot;
		}
		for (let k = 0; k < m; k++) {
			if (k === i) {
				continue;
			}
			const factor = matrix[k][i];
			for (let j = i; j <= m; j++) {
				matrix[k][j] -= factor * matrix[i][j];
			}
		}
	}

	return matrix.map((row) => row[m]);
}

/**
 * Coefficient of determination (R-squared) of an arbitrary fit function
 * against data. Mirrors `computeRSquared` in chart-trendlines.tsx (React).
 */
export function computeRSquared(
	xVals: number[],
	yVals: number[],
	evalFn: (x: number) => number,
): number {
	const n = xVals.length;
	if (n === 0) {
		return 0;
	}
	const meanY = yVals.reduce((s, y) => s + y, 0) / n;
	let ssRes = 0;
	let ssTot = 0;
	for (let i = 0; i < n; i++) {
		ssRes += (yVals[i] - evalFn(xVals[i])) ** 2;
		ssTot += (yVals[i] - meanY) ** 2;
	}
	return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

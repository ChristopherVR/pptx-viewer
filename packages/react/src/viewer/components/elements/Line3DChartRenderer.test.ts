import { describe, it, expectTypeOf } from 'vitest';

// ---------------------------------------------------------------------------
// Module shape (mounting behaviour itself needs a real WebGL context, which
// jsdom/happy-dom do not provide; see ChartElementView.line3d.test.tsx for the
// branch-selection coverage that does not require `three` to actually run).
// ---------------------------------------------------------------------------

describe('line3DChartRenderer module', () => {
	it('exports Line3DChartRenderer as a named export', async () => {
		// A cold import here pulls in the full chart-rendering utils barrel
		// (the SVG fallback path), which transforms slowly on a fresh run; the
		// default 5s test timeout is too tight for that, not for the module
		// itself.
		const mod = await import('./Line3DChartRenderer');
		expectTypeOf(mod.Line3DChartRenderer).toBeFunction();
	}, 30000);
});

import { describe, it, expectTypeOf } from 'vitest';

// ---------------------------------------------------------------------------
// Module shape (mounting behaviour itself needs a real WebGL context, which
// jsdom/happy-dom do not provide; see ChartElementView.area3d.test.tsx for the
// branch-selection coverage that does not require `three` to actually run).
// ---------------------------------------------------------------------------

describe('area3DChartRenderer module', () => {
	it('exports Area3DChartRenderer as a named export', async () => {
		// A cold import here pulls in the full chart-rendering utils barrel
		// (the SVG fallback path), which transforms slowly on a fresh run; the
		// default 5s test timeout is too tight for that, not for the module
		// itself.
		const mod = await import('./Area3DChartRenderer');
		expectTypeOf(mod.Area3DChartRenderer).toBeFunction();
	}, 30000);
});

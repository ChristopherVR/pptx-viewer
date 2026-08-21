import { describe, it, expectTypeOf } from 'vitest';

// ---------------------------------------------------------------------------
// Module shape (mounting behaviour itself needs a real WebGL context, which
// jsdom/happy-dom do not provide; see ChartElementView.surface3d.test.tsx for
// the branch-selection coverage that does not require `three` to actually run).
// ---------------------------------------------------------------------------

describe('surfaceChart3DRenderer module', () => {
	it('exports SurfaceChart3DRenderer as a named export', async () => {
		// A cold import here pulls in the full chart-rendering utils barrel
		// (the SVG fallback path), which transforms slowly on a fresh run; the
		// default 5s test timeout is too tight for that, not for the module
		// itself.
		const mod = await import('./SurfaceChart3DRenderer');
		expectTypeOf(mod.SurfaceChart3DRenderer).toBeFunction();
	}, 30000);
});

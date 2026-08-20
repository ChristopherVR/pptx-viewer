/**
 * table-properties-helpers.test.ts: Vitest unit tests for the pure table
 * properties helpers (gradient CSS building). Table quick-style preset
 * application, column-width redistribution, and the "distribute evenly"
 * helpers now live in `pptx-viewer-shared` and are tested there.
 */
import { describe, expect, it } from 'vitest';

import { buildGradientFillCss } from './table-properties-helpers';

// Table quick-style preset application moved to `pptx-viewer-shared`'s
// `render/table-style-presets.test.ts` (`applyTableStylePreset`). Column-width
// redistribution and "distribute evenly" one-liners moved to
// `pptx-viewer-shared`'s `render/table-resize.test.ts`
// (`redistributeColumnWidth` / `evenColumnWidths` / `evenRowHeights`); this
// component only wires their input onto that shared implementation now.

describe('buildGradientFillCss', () => {
	it('builds a linear gradient with sorted stops and angle', () => {
		const css = buildGradientFillCss(
			[
				{ color: '#00F', position: 100 },
				{ color: '#F00', position: 0 },
			],
			'linear',
			45,
		);
		// 45 is the OOXML angle; CSS sits a quarter turn away.
		expect(css).toBe('linear-gradient(135deg, #F00 0%, #00F 100%)');
	});

	it('builds a radial gradient', () => {
		const css = buildGradientFillCss([{ color: '#F00', position: 0 }], 'radial', 90);
		expect(css).toContain('radial-gradient(circle');
	});
});

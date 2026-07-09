import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SurfaceChart3D } from './SurfaceChart3D';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

// These tests run in the default node environment (no DOM, no `useEffect`), so
// `renderToStaticMarkup` exercises the synchronous render path: the Three.js
// availability probe runs in an effect and never fires here, leaving
// `threeAvailable === null`, which renders the loading placeholder. That is
// enough to assert the component mounts WITHOUT statically importing three or
// `@react-three/*` (those are dynamic, effect-gated imports).

const mkElement = (): PptxElement =>
	({
		id: 'c1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 320,
		height: 240,
	}) as PptxElement;

const mkChartData = (): PptxChartData => ({
	chartType: 'surface',
	title: 'Heat',
	categories: ['A', 'B', 'C'],
	series: [
		{ name: 'S1', values: [1, 2, 3] },
		{ name: 'S2', values: [2, 3, 4] },
	],
});

describe('surfaceChart3D component', () => {
	it('renders without throwing and without statically pulling in three', () => {
		expect(() =>
			renderToStaticMarkup(
				<SurfaceChart3D
					element={mkElement()}
					chartData={mkChartData()}
					categoryLabels={['A', 'B', 'C']}
					fallback={<div data-testid='fallback'>2d</div>}
				/>,
			),
		).not.toThrow();
	});

	it('shows the loading placeholder while the three probe is pending', () => {
		const html = renderToStaticMarkup(
			<SurfaceChart3D
				element={mkElement()}
				chartData={mkChartData()}
				categoryLabels={['A', 'B', 'C']}
				fallback={<div data-testid='fallback'>2d</div>}
			/>,
		);
		// Probe (an effect) has not resolved under SSR, so neither the 2D fallback
		// nor the 3D scene is shown yet: the loading placeholder is rendered.
		expect(html).toContain('Loading 3D surface');
		expect(html).not.toContain('data-testid="fallback"');
	});
});

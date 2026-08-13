/**
 * Only ONE node in the document may answer to a given `data-element-id`.
 *
 * Angular reuses the live `SlideCanvasComponent` for its miniatures, unlike the
 * other four bindings (React's thumbnails go through a separate
 * `StaticElementRenderer` that stamps no id: "exposing their ids there would put
 * two nodes with the same id in the document"). The thumbnail rail therefore
 * painted every element of EVERY slide with its real id, permanently, so a
 * framework-neutral `[data-element-id]` query answered from a slide that was not
 * on screen. `e2e/custom-shows.spec.ts` read "Alpha Slide" out of the rail on
 * every step of a running show and failed on angular alone, while the show
 * itself was on the right slide the whole time.
 *
 * This is a source-text guard because the package has no TestBed (see
 * `vitest.config.ts` and `element-contract-ownership.test.ts`, which guards the
 * other half of the same contract).
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const VIEWER_DIR = import.meta.dirname;

/** Surfaces that paint every slide (or every layout) at once. */
const MINIATURE_SURFACES = [
	'slides-panel.component.ts',
	'mobile-slides-sheet.component.ts',
	'slide-sorter-overlay.component.ts',
	'presenter-slide-navigator.component.ts',
	'slide-diff-thumbnails.component.ts',
	'ribbon-layout-gallery.component.ts',
];

describe('miniature surfaces expose no element ids', () => {
	it.each(MINIATURE_SURFACES)('%s turns the element-id gate off', (file) => {
		expect(componentSource(VIEWER_DIR, file)).toMatch(/\[exposeElementIds?\]="false"/u);
	});

	it('leaves the ids on the live presentation stage', () => {
		// The morph engine generates keyframe CSS that selects on
		// `[data-element-id]`, so the show stage must keep them even though it is
		// not interactive. That is why the gate is separate from `interactive`.
		const overlay = componentSource(VIEWER_DIR, 'presentation-overlay.component.ts');
		expect(overlay).toContain('[interactive]="false"');
		expect(overlay).not.toContain('[exposeElementIds]="false"');
	});

	it('defaults the gate ON, so an unspecified canvas keeps the contract', () => {
		expect(componentSource(VIEWER_DIR, 'slide-canvas.component.ts')).toContain(
			'readonly exposeElementIds = input<boolean>(true);',
		);
		expect(componentSource(VIEWER_DIR, 'element-renderer.component.ts')).toContain(
			'readonly exposeElementId = input<boolean>(true);',
		);
	});
});

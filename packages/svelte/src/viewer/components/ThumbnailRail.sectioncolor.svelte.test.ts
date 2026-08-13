/**
 * The section colour marker in the Svelte thumbnail rail.
 *
 * `p15:sectionPr/@clr` is parsed and round-tripped by core, and React paints it
 * as a small dot in its section header. Svelte showed nothing, so a deck whose
 * author had colour-coded its sections lost that entirely on this binding.
 * A section with no colour keeps rendering no marker at all, exactly like
 * React's `{section.color && ...}`.
 */
import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ThumbnailRail from './ThumbnailRail.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const CANVAS = { width: 960, height: 540 };

// `groupSlidesBySection` groups off `slide.sectionId`, not the section's own
// membership list, so the slides carry the back-reference.
function deck(): PptxSlide[] {
	return Array.from(
		{ length: 2 },
		(_unused, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				sectionId: `sec${index + 1}`,
				elements: [],
			}) as PptxSlide,
	);
}

function mountRail(sections: PptxSection[]): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ThumbnailRail, {
		target,
		props: {
			slides: deck(),
			canvasSize: CANVAS,
			mediaDataUrls: new Map<string, string>(),
			current: 0,
			sections,
			onselect: () => undefined,
		},
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return target;
}

describe('thumbnail rail section colour', () => {
	it('paints a swatch for a section that declares one', () => {
		const target = mountRail([
			{ id: 'sec1', name: 'Intro', slideIds: ['s1'], color: '#ff0000' } as PptxSection,
			{ id: 'sec2', name: 'Body', slideIds: ['s2'] } as PptxSection,
		]);

		const swatches = target.querySelectorAll<HTMLElement>('[data-pptx-section-color]');
		expect(swatches).toHaveLength(1);
		expect(swatches[0].dataset.pptxSectionColor).toBe('#ff0000');
		// happy-dom keeps the authored hex; a real browser serialises it to rgb().
		expect(swatches[0].style.background).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
	});

	it('renders no marker when no section declares a colour', () => {
		const target = mountRail([
			{ id: 'sec1', name: 'Intro', slideIds: ['s1'] } as PptxSection,
			{ id: 'sec2', name: 'Body', slideIds: ['s2'] } as PptxSection,
		]);

		expect(target.querySelectorAll('[data-pptx-section-color]')).toHaveLength(0);
	});
});

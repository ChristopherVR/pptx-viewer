/**
 * The section colour marker in the vanilla thumbnail rail.
 *
 * `p15:sectionPr/@clr` is parsed and round-tripped by core, and React paints it
 * as a small dot in its section header. Vanilla showed nothing, so a deck whose
 * author had colour-coded its sections lost that entirely on this binding.
 * A section with no colour keeps rendering no marker at all, exactly like
 * React's `{section.color && ...}`.
 */
import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { renderThumbnailSections } from './thumbnail-sections';

// `groupSlidesBySection` groups off `slide.sectionId`, not the section's own
// membership list, so the slides carry the back-reference.
function slides(): PptxSlide[] {
	return Array.from({ length: 2 }, (_unused, index) => ({
		id: `s${index + 1}`,
		rId: `rId${index + 1}`,
		slideNumber: index + 1,
		sectionId: `sec${index + 1}`,
		elements: [],
	})) as PptxSlide[];
}

function render(sections: PptxSection[]): HTMLElement {
	const host = document.createElement('div');
	host.append(
		...renderThumbnailSections({
			doc: document,
			t: createTranslator(),
			sections,
			slides: slides(),
			buildSlide: () => document.createElement('button'),
		}),
	);
	return host;
}

describe('thumbnail section colour', () => {
	it('paints a swatch for a section that declares one', () => {
		const host = render([
			{ id: 'sec1', name: 'Intro', slideIds: ['s1'], color: '#ff0000' },
			{ id: 'sec2', name: 'Body', slideIds: ['s2'] },
		]);

		const swatches = host.querySelectorAll<HTMLElement>('[data-pptx-section-color]');
		expect(swatches).toHaveLength(1);
		expect(swatches[0].dataset.pptxSectionColor).toBe('#ff0000');
		// happy-dom keeps the authored hex; a real browser serialises it to rgb().
		expect(swatches[0].style.background).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
	});

	it('renders no marker when no section declares a colour', () => {
		const host = render([
			{ id: 'sec1', name: 'Intro', slideIds: ['s1'] },
			{ id: 'sec2', name: 'Body', slideIds: ['s2'] },
		]);

		expect(host.querySelectorAll('[data-pptx-section-color]')).toHaveLength(0);
	});
});

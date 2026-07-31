import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The hidden-slide cue in the Angular slides panel and slide sorter.
 *
 * Both keep LISTING a hidden slide on purpose (hiding only removes it from the
 * show). The panel gave NO indication at all; the sorter dimmed the cell, which
 * is a colour-only signal and said nothing to a screen reader. Both now carry
 * the three shared signals.
 *
 * No Angular TestBed in this package's suite (see `vitest.config.ts`), so the
 * cue's logic is exercised through the shared helper the components call, and
 * the template contract is read from the source. The bindings asserted here are
 * literally the attributes the browser ends up with.
 */
import { describe, expect, it } from 'vitest';

import { HIDDEN_SLIDE_SLASH_GRADIENT, hiddenSlideCue } from '../internal/shared';

const PANEL_TEMPLATE = readFileSync(
	path.join(import.meta.dirname, 'slides-panel.component.html'),
	'utf8',
);
const PANEL_SOURCE = readFileSync(
	path.join(import.meta.dirname, 'slides-panel.component.ts'),
	'utf8',
);
const SORTER_TEMPLATE = readFileSync(
	path.join(import.meta.dirname, 'slide-sorter-overlay.component.html'),
	'utf8',
);
const SORTER_SOURCE = readFileSync(
	path.join(import.meta.dirname, 'slide-sorter-overlay.component.ts'),
	'utf8',
);

describe('slides panel hidden-slide cue', () => {
	it('resolves the cue per card from the shared helper, not a local re-derivation', () => {
		expect(PANEL_SOURCE).toContain('hiddenSlideCue(slide.hidden');
		expect(PANEL_TEMPLATE).toContain('@let hidden = hiddenCue(slide, i);');
	});

	it('marks the card with the neutral attribute and omits it when visible', () => {
		expect(PANEL_TEMPLATE).toContain('[attr.data-pptx-slide-hidden]="hidden.marker ?? null"');
		expect(hiddenSlideCue(true, 'rail', 1).marker).toBe('true');
		expect(hiddenSlideCue(false, 'rail', 1).marker).toBeUndefined();
	});

	it('slashes the slide number and dims the preview, so the cue is not colour alone', () => {
		expect(PANEL_TEMPLATE).toContain(
			'[style.background-image]="hidden.hidden ? slashGradient : null"',
		);
		expect(PANEL_TEMPLATE).toContain('[style.opacity]="hidden.hidden ? dimOpacity : null"');
		// Bound from the shared constant rather than copied into the stylesheet,
		// which a component CSS file could not read and would be free to drift.
		expect(PANEL_SOURCE).toContain('readonly slashGradient = HIDDEN_SLIDE_SLASH_GRADIENT;');
		expect(HIDDEN_SLIDE_SLASH_GRADIENT).toContain('currentColor');
	});

	it('describes the state instead of folding it into the accessible name', () => {
		// `e2e/support/deck.ts` matches ^Go to slide N$ exactly; the name must not move.
		expect(PANEL_TEMPLATE).toContain(
			'[attr.aria-label]="\'pptx.slidesPanel.goToSlide\' | translate: { n: i + 1 }"',
		);
		expect(PANEL_TEMPLATE).toContain('[attr.aria-describedby]="hidden.labelId ?? null"');
		expect(PANEL_TEMPLATE).toContain('class="pptx-ng-spanel-hidden" [id]="hidden.labelId"');
		expect(PANEL_TEMPLATE).toContain('hiddenLabelKey | translate');
		expect(hiddenSlideCue(true, 'rail', 1).labelId).toBe('pptx-hidden-slide-rail-1');
	});
});

describe('slide sorter hidden-slide cue', () => {
	it('keeps the dim and adds the two signals it cannot carry', () => {
		expect(SORTER_TEMPLATE).toContain('[class.is-hidden]="hidden.hidden"');
		expect(SORTER_TEMPLATE).toContain(
			'[style.background-image]="hidden.hidden ? slashGradient : null"',
		);
		expect(SORTER_TEMPLATE).toContain('class="pptx-ng-sorter-hidden" [id]="hidden.labelId"');
		expect(SORTER_TEMPLATE).toContain('hiddenLabelKey | translate');
	});

	it('marks and describes the cell', () => {
		expect(SORTER_TEMPLATE).toContain('[attr.data-pptx-slide-hidden]="hidden.marker ?? null"');
		expect(SORTER_TEMPLATE).toContain('[attr.aria-describedby]="hidden.labelId ?? null"');
		expect(SORTER_SOURCE).toContain("hiddenSlideCue(this.isHiddenSlide(slide), 'sorter', index)");
	});

	it('uses its own id space, because the sorter mounts on top of the panel', () => {
		expect(hiddenSlideCue(true, 'sorter', 2).labelId).not.toBe(
			hiddenSlideCue(true, 'rail', 2).labelId,
		);
	});
});

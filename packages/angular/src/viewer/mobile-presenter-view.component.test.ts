import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { presenterNextDisabled, presenterPrevDisabled } from '../internal/shared';
import { componentSource } from './component-source.test-support';

/**
 * The phone console obeys the DESKTOP console's navigation rules.
 *
 * `presenter-console-helpers.test.ts` pins those rules for the split-screen
 * console: Previous is dead only on the first slide, and Next is never dead,
 * because PowerPoint advances from the last slide to the end-of-show screen and
 * then out of the show. This layout was written against a near-duplicate helper
 * (`isLastSlide`) and disabled Next on the last slide, so the same deck stranded
 * a presenter on a phone and let them finish on a laptop.
 *
 * Asserted against the authored component + template text because this package
 * has no TestBed (see `vitest.config.ts`), the same technique the other
 * component contract specs use.
 */
const SOURCE = componentSource(
	dirname(fileURLToPath(import.meta.url)),
	'mobile-presenter-view.component.ts',
);

describe('the phone presenter console', () => {
	it('binds both navigation controls to the shared predicates', () => {
		expect(SOURCE).toContain('presenterPrevDisabled(this.currentSlideIndex())');
		expect(SOURCE).toContain('presenterNextDisabled()');
		expect(SOURCE).toContain('[disabled]="prevDisabled()"');
		expect(SOURCE).toContain('[disabled]="nextDisabled()"');
		// The near-duplicate that made the phone disagree with the desktop.
		expect(SOURCE).not.toContain('isLastSlide');
	});

	it('carries the neutral presenter-control contract the parity suite measures', () => {
		expect(SOURCE).toContain('data-pptx-presenter-control="prev"');
		expect(SOURCE).toContain('data-pptx-presenter-control="next"');
	});

	it('agrees with the desktop console about the last slide', () => {
		expect(presenterNextDisabled()).toBeFalsy();
		expect(presenterPrevDisabled(0)).toBeTruthy();
		expect(presenterPrevDisabled(1)).toBeFalsy();
	});
});

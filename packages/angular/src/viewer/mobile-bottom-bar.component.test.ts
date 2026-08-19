/**
 * mobile-bottom-bar.component.test.ts: disabled-gating regression guard.
 *
 * The bottom bar used to hand-roll its own `noSlides = count === 0` check,
 * duplicating shared's `buildBarActions`. That duplicate happened to compute
 * the right answer, but Rule 2 (extract shared logic) still applies: this
 * guards that the component sources `disabled` from the shared descriptor
 * instead of a local copy that could silently drift from React/Vue, which
 * had no gating at all before this fix.
 *
 * No Angular TestBed (see `vitest.config.ts`), so the wiring is asserted
 * against the authored source, the same technique the other component
 * contract specs use; the actual disabled-at-zero behaviour is asserted
 * directly against the shared pure function the component delegates to.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';
import { buildBarActions } from './mobile-chrome-helpers';

const SOURCE = componentSource(
	dirname(fileURLToPath(import.meta.url)),
	'mobile-bottom-bar.component.ts',
);

describe('mobile bottom bar disabled gating', () => {
	it('sources each slot disabled state from shared buildBarActions, not a hand-rolled check', () => {
		expect(SOURCE).toContain("from './mobile-chrome-helpers'");
		expect(SOURCE).toContain('buildBarActions({ slideCount: this.slideCount() })');
		expect(SOURCE).not.toContain('noSlides');
	});

	it('every rendered slot binds its [disabled] attribute to the computed action', () => {
		expect(SOURCE).toContain('[disabled]="action.disabled"');
	});

	it('agrees with the shared descriptor: every slot disables at slideCount 0', () => {
		expect(buildBarActions({ slideCount: 0 }).every((action) => action.disabled)).toBeTruthy();
		expect(buildBarActions({ slideCount: 3 }).every((action) => !action.disabled)).toBeTruthy();
	});
});

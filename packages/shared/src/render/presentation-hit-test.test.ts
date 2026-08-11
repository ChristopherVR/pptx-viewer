import { describe, expect, it } from 'vitest';

import {
	inlineElementPointerEvents,
	PRESENTATION_HIT_TEST_CSS,
	PRESENTATION_STAGE_ATTRIBUTE,
} from './presentation-hit-test';

describe('inlineElementPointerEvents', () => {
	it('locks a non-interactive element on the editing canvas', () => {
		// An inherited master / layout shape with template editing off: nothing but
		// this inline value tells the DOM node it is locked.
		expect(inlineElementPointerEvents({ interactive: false, presenting: false })).toBe('none');
	});

	it('leaves an interactive element alone', () => {
		expect(inlineElementPointerEvents({ interactive: true, presenting: false })).toBeUndefined();
	});

	it('never writes an inline lock during a show, whatever interactive says', () => {
		// The rule on the show stage is the stylesheet below, which re-enables an
		// actionable shape nested inside inert scenery. An inline `none` outranks
		// any stylesheet, so writing one here made every Action Setting on the
		// slide unclickable and the show advanced instead of following the link.
		expect(inlineElementPointerEvents({ interactive: false, presenting: true })).toBeUndefined();
		expect(inlineElementPointerEvents({ interactive: true, presenting: true })).toBeUndefined();
	});
});

describe('pRESENTATION_HIT_TEST_CSS', () => {
	it('is scoped to the running-show stage attribute', () => {
		expect(PRESENTATION_HIT_TEST_CSS).toContain(`[${PRESENTATION_STAGE_ATTRIBUTE}]`);
	});

	it('makes scenery transparent and re-enables what owns its own click', () => {
		expect(PRESENTATION_HIT_TEST_CSS).toMatch(/\[data-element-id\][^}]*pointer-events:\s*none/u);
		expect(PRESENTATION_HIT_TEST_CSS).toMatch(/\[data-pptx-action\][^}]*pointer-events:\s*auto/u);
	});

	it('re-enables the action rule after the blanket rule, so the cascade favours it', () => {
		// Both selectors carry the same specificity, so the ORDER is what decides.
		expect(PRESENTATION_HIT_TEST_CSS.indexOf('[data-pptx-action]')).toBeGreaterThan(
			PRESENTATION_HIT_TEST_CSS.indexOf('[data-element-id] {'),
		);
	});
});

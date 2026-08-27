import { EMPTY_RIBBON_TRANSITION_DRAFT } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import type { EditActions } from '../../editor/editor-edit-ops';
import type { FindReplaceActions } from '../../editor/editor-find-replace-actions';
import { createTranslator } from '../../i18n';
import { buildViewerCss } from '../../styles';
import { createRibbon } from './ribbon';
import type { RibbonHandlers, RibbonInsertHandlers } from './ribbon-types';

/**
 * A ribbon button's hit area must stay inside its own bounding rect.
 *
 * The bug this guards: `.pptxv-btn` is a FIXED 28x28 icon box that does not
 * clip, so a button built with a text label ("Hide Slide", "Rehearse Timings")
 * painted that label outside its own border box, centred, spilling over the
 * buttons either side of it. Overflowing text is still hit-tested as part of
 * its button and later siblings paint last, so `elementFromPoint` at one
 * button's centre resolved to the button on its RIGHT: a coordinate click, a
 * touch tap and Playwright's `click()` all activated the wrong command. Four
 * tabs (Slide Show, Review, View, Help) shipped that way, and the same rows
 * were visually an unreadable pile of overlapping words.
 *
 * The real check is geometric (`document.elementFromPoint(centre)` resolves to
 * the button whose rect was sampled), and it is run against the live demos.
 * happy-dom, which this suite runs on, has no layout engine: every rect is
 * 0x0 and `elementFromPoint` cannot answer. So the assertions below encode the
 * invariant that MAKES the geometric check pass, in the two halves that have to
 * agree for a label to stay inside its box:
 *
 *  1. every ribbon button that renders text matches at least one stylesheet
 *     rule that frees its width, and
 *  2. the stylesheet still locks `.pptxv-btn` to 28px, which is what makes (1)
 *     load-bearing rather than decorative.
 *
 * The rule set in (1) is read out of the real stylesheet rather than hardcoded,
 * so a new auto-width variant is honoured automatically and deleting the one
 * that fixed this bug fails here.
 */

/** A fake action bag: every method access returns a fresh `vi.fn()`, memoised. */
function fakeActions<T extends object>(): T {
	const cache = new Map<string, ReturnType<typeof vi.fn>>();
	return new Proxy({} as T, {
		get(_target, prop) {
			if (typeof prop !== 'string') {
				return undefined;
			}
			let fn = cache.get(prop);
			if (!fn) {
				fn = vi.fn();
				cache.set(prop, fn);
			}
			return fn;
		},
	});
}

function buildHandlers(): RibbonHandlers {
	return {
		nav: fakeActions<RibbonHandlers['nav']>(),
		primary: fakeActions<RibbonHandlers['primary']>(),
		file: fakeActions<RibbonHandlers['file']>(),
		slideShow: fakeActions<RibbonHandlers['slideShow']>(),
		insert: fakeActions<RibbonInsertHandlers>(),
		edit: fakeActions<EditActions>(),
		findReplace: fakeActions<FindReplaceActions>(),
		design: fakeActions<RibbonHandlers['design']>(),
		transitions: {
			readDraft: () => ({ ...EMPTY_RIBBON_TRANSITION_DRAFT }),
			applyDraft: vi.fn(),
			readTransition: () => undefined,
			applyChange: vi.fn(),
		},
		draw: fakeActions<RibbonHandlers['draw']>(),
	};
}

/**
 * Selectors in the viewer stylesheet that release a button from a fixed width.
 *
 * Parsed from the emitted CSS text so the invariant tracks the stylesheet
 * instead of a list that drifts from it. At-rule preludes and nested blocks are
 * dropped: a naive block split turns `@media (...) { .foo {` into a selector
 * that means nothing, and none of the auto-width rules this cares about live
 * inside a media query.
 */
function autoWidthSelectors(css: string): string[] {
	const selectors: string[] = [];
	// Comments first: a `/* ... */` between two rules is otherwise swallowed
	// into the next rule's prelude, and every selector comes out unparseable.
	const rules = css.replace(/\/\*[\s\S]*?\*\//gu, '');
	for (const [, prelude, body] of rules.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
		const selector = prelude.trim();
		if (selector.startsWith('@') || selector.includes('}')) {
			continue;
		}
		if (!/(^|[\s;])width\s*:\s*auto\s*(;|$)/u.test(body)) {
			continue;
		}
		for (const part of selector.split(',')) {
			const trimmed = part.trim();
			if (trimmed.startsWith('@') || trimmed.length === 0) {
				continue;
			}
			selectors.push(trimmed);
		}
	}
	return selectors;
}

/** Does any auto-width rule in the stylesheet apply to this element? */
function sizesToContent(button: Element, selectors: readonly string[]): boolean {
	return selectors.some((selector) => {
		try {
			return button.matches(selector);
		} catch {
			// A selector happy-dom cannot parse tells us nothing either way.
			return false;
		}
	});
}

/** Every `.pptxv-btn` in the ribbon, across all tab panes, hidden or not. */
function ribbonIconButtons(root: HTMLElement): HTMLButtonElement[] {
	return Array.from(root.querySelectorAll<HTMLButtonElement>('button.pptxv-btn'));
}

describe('ribbon button hit areas', () => {
	it('lets every text-labelled ribbon button size to its own label', () => {
		const ribbon = createRibbon(document, createTranslator(), buildHandlers());
		const selectors = autoWidthSelectors(buildViewerCss());
		expect(selectors.length).toBeGreaterThan(0);

		const buttons = ribbonIconButtons(ribbon.el);
		// Guards the vacuous pass: a ribbon that built nothing agrees with
		// every rule about buttons it does not have.
		expect(buttons.length).toBeGreaterThan(20);

		// Any name listed here renders a text label inside the fixed 28px icon
		// box, so the label overflows and steals its neighbour's hit area.
		const trapped = buttons
			.filter((button) => (button.textContent ?? '').trim().length > 0)
			.filter((button) => !sizesToContent(button, selectors))
			.map((button) => button.getAttribute('aria-label') ?? button.textContent);
		expect(trapped).toStrictEqual([]);
	});

	it('tags a text-labelled button so the stylesheet can find it', () => {
		const ribbon = createRibbon(document, createTranslator(), buildHandlers());
		const labelled = ribbonIconButtons(ribbon.el).filter(
			(button) => (button.textContent ?? '').trim().length > 0,
		);
		expect(labelled.length).toBeGreaterThan(0);
		// Any name listed here carries no text-button class, so no rule can
		// widen it however the stylesheet is written.
		const untagged = labelled
			.filter(
				(button) =>
					!button.classList.contains('pptxv-btn-text') &&
					!button.classList.contains('pptxv-btn-pill'),
			)
			.map((button) => button.getAttribute('aria-label'));
		expect(untagged).toStrictEqual([]);
	});

	it('keeps the icon-button primitive at a fixed 28px, which is what makes the tag matter', () => {
		const css = buildViewerCss();
		const base = /\.pptxv-btn\s*\{([^}]*)\}/u.exec(css);
		expect(base?.[1]).toMatch(/width:\s*28px/u);
		const text = /\.pptxv-btn\.pptxv-btn-text\s*\{([^}]*)\}/u.exec(css);
		expect(text?.[1]).toMatch(/width:\s*auto/u);
		// Without this the row re-creates the overflow the moment it runs out of
		// width, because a flex item shrinks below its content by default.
		expect(text?.[1]).toMatch(/flex:\s*none/u);
	});
});

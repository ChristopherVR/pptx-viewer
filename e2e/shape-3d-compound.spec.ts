/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Shape 3D, compound outlines and empty-paragraph bullets, checked identically
 * in every binding.
 *
 * All three come from the same failure mode: a binding hand-porting logic that
 * `pptx-viewer-shared` already owns, then losing part of it. The 2026-08 audit
 * found the Angular binding never called `getComputed3dStyle` (so `a:sp3d` /
 * `a:scene3d` rendered flat there and correct in the other four, while its
 * inspector still offered the controls that author them), had no
 * `a:ln/@cmpd` support at all, and carried a hand-ported paragraph builder that
 * had dropped shared's "suppress the bullet on a paragraph with no visible
 * text" rule.
 *
 * None of the three was visible to any suite: every binding's unit tests were
 * green, and no fixture in `e2e/fixtures` contained an `a:sp3d`, a compound
 * `a:ln` or a whitespace-only bullet paragraph. `e2e/fixtures/shape-3d-compound.pptx`
 * (built by `scripts/make-shape-3d-fixture.mjs`) exists for exactly that, and
 * each case is measured against a CONTROL element in the same deck, so the
 * assertions say "3D differs from flat" rather than pinning one binding's
 * pixels.
 *
 * Run: bunx playwright test shape-3d-compound
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/shape-3d-compound.pptx', import.meta.url)),
);

const LOAD_TIMEOUT_MS = 60_000;

/** Computed paint for one rendered element, found by its accessible name. */
interface Paint {
	transform: string;
	perspective: string;
	transformStyle: string;
	boxShadow: string;
	borderTopStyle: string;
	borderTopWidth: string;
	borderTopColor: string;
}

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 1"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

/**
 * Read the computed style of the largest element with this id suffix, so a
 * slide-rail thumbnail can never win.
 *
 * Elements are addressed by the core-assigned `data-element-id`, the id every
 * binding stamps on the rendered element; the deck authors the shapes in a
 * fixed order, so `shape-0` is the bevelled block, `shape-1` its flat control,
 * and so on (see `scripts/make-shape-3d-fixture.mjs`).
 */
async function paintOf(page: Page, idSuffix: string): Promise<Paint | null> {
	return page.evaluate((suffix) => {
		let best: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith(suffix)) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				best = node;
			}
		}
		if (!best) {
			return null;
		}
		const style = getComputedStyle(best);
		return {
			transform: style.transform,
			perspective: style.perspective,
			transformStyle: style.transformStyle,
			boxShadow: style.boxShadow,
			borderTopStyle: style.borderTopStyle,
			borderTopWidth: style.borderTopWidth,
			borderTopColor: style.borderTopColor,
		};
	}, idSuffix);
}

/**
 * How many bullet markers the three-paragraph list actually paints.
 *
 * Counted from the element's rendered TEXT rather than from a marker element,
 * because each binding wraps the marker in its own node: the character is on
 * screen either way, and a stray marker on the whitespace-only paragraph shows
 * up as a third one.
 */
async function bulletMarkerCount(page: Page): Promise<number> {
	return page.evaluate(() => {
		let best: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith('shape-4')) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				best = node;
			}
		}
		if (!best) {
			return -1;
		}
		return ((best.textContent ?? '').match(/•/gu) ?? []).length;
	});
}

test.describe('shape 3D (a:scene3d / a:sp3d)', () => {
	test('a bevelled, extruded block renders in 3D, not flat', async ({ page }) => {
		await loadDeck(page);

		const bevelled = await paintOf(page, 'shape-0');
		const flat = await paintOf(page, 'shape-1');
		expect(bevelled, 'found the 3D block').not.toBeNull();
		expect(flat, 'found the control block').not.toBeNull();

		// The camera preset becomes a real 3D transform + perspective. The control
		// block, identical but for its `a:scene3d`, has neither: a binding that
		// ignores shape 3D paints the two the same way.
		expect(bevelled?.transform).not.toBe('none');
		expect(bevelled?.transform).not.toBe(flat?.transform);
		expect(bevelled?.perspective).not.toBe('none');
		expect(bevelled?.transformStyle).toBe('preserve-3d');

		// `a:sp3d/@extrusionH` + `a:bevelT` become stacked depth shadows.
		expect(bevelled?.boxShadow).not.toBe('none');
		expect(flat?.boxShadow).toBe('none');
	});
});

test.describe('compound outlines (a:ln/@cmpd)', () => {
	test('a dbl outline paints as more than one strand', async ({ page }) => {
		await loadDeck(page);

		const compound = await paintOf(page, 'shape-2');
		const single = await paintOf(page, 'shape-3');
		expect(compound, 'found the compound-outlined shape').not.toBeNull();
		expect(single, 'found the control shape').not.toBeNull();

		// `border-style: double` is the one CSS border style that paints two
		// strands with a gap, which is what `cmpd="dbl"` means. The control shape
		// is the same width and colour with `cmpd="sng"`.
		expect(compound?.borderTopStyle).toBe('double');
		expect(single?.borderTopStyle).toBe('solid');
		// Same authored `a:ln/@w`, so the compound line must not be drawn thinner.
		expect(compound?.borderTopWidth).toBe(single?.borderTopWidth);
		expect(compound?.borderTopColor).toBe(single?.borderTopColor);
	});
});

test.describe('bullets on paragraphs with no visible text', () => {
	test('a whitespace-only paragraph draws no marker', async ({ page }) => {
		await loadDeck(page);

		const markers = await bulletMarkerCount(page);
		// Three authored paragraphs, all carrying `a:buChar`; only the two with
		// real text may show a marker. A builder that resolves the bullet off the
		// paragraph's first segment unconditionally paints three.
		expect(markers, 'found the bulleted list').toBeGreaterThanOrEqual(0);
		expect(markers).toBe(2);
	});
});

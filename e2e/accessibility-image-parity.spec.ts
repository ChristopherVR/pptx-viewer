/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Accessibility parity for pictures: does every binding apply the same
 * `role` / `aria-label` / `aria-hidden` contract for a described picture and
 * a "Mark as decorative" one?
 *
 * `packages/shared/src/render/element-accessibility-dom.ts`'s
 * `applyRenderedElementAccessibility` is the shared DOM applier every binding
 * is meant to call at its stage boundary:
 *  - a DESCRIBED picture (`p:cNvPr/@descr`) gets `role="img"`, an
 *    `aria-label` equal to the alt text, and no `aria-hidden`;
 *  - a DECORATIVE picture (`adec:decorative` val="1") gets NO `role`, an
 *    EMPTY `aria-label`, and `aria-hidden="true"`, so assistive tech skips it
 *    entirely - PowerPoint's own "Mark as decorative" behaviour.
 *
 * A binding that renders `alt=""` on the underlying `<img>` for BOTH (the
 * correct convention: the accessible name lives on the wrapper, not the
 * native `<img>`) is not itself a defect; this spec reads the WRAPPER node.
 *
 * Queries are scoped to `[data-pptx-viewport]` (the live canvas), not a bare
 * `[data-element-id]`: several bindings stamp the SAME element id on both the
 * main canvas node and its thumbnail-rail copy, and the thumbnail copy can
 * carry no accessibility attributes at all (or a stale pre-applier pass), so
 * an unscoped query can silently match the wrong copy - `support/deck.ts`'s
 * `slideElements` exists for exactly this reason.
 *
 * Fixture: `accessibility-images.pptx` (one described, one decorative picture).
 *
 * Run: bunx playwright test accessibility-image-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { DESCRIBED_ALT_TEXT } from './fixtures/generate-accessibility-images-fixture';
import { fixture, loadDeckAt, slideElements, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('accessibility-images.pptx');

interface A11yFacts {
	role: string | null;
	ariaLabel: string | null;
	ariaHidden: string | null;
}

const EMPTY_FACTS: A11yFacts = { role: null, ariaLabel: null, ariaHidden: null };

/** Every picture wrapper on the LIVE canvas, in DOM (authoring) order. */
async function readCanvasPictures(page: Page): Promise<A11yFacts[]> {
	const nodes = slideElements(page).filter({ has: page.locator('img') });
	const count = await nodes.count();
	const facts: A11yFacts[] = [];
	for (let i = 0; i < count; i++) {
		const node = nodes.nth(i);
		facts.push({
			role: await node.getAttribute('role'),
			ariaLabel: await node.getAttribute('aria-label'),
			ariaHidden: await node.getAttribute('aria-hidden'),
		});
	}
	return facts;
}

async function readSlide(
	page: Page,
	origin: string,
): Promise<{ described: A11yFacts; decorative: A11yFacts }> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(500);

	// The fixture authors the described picture FIRST, the decorative one
	// second; both are plain `p:pic` at the top level of the slide, so
	// authoring order is DOM order in every binding.
	const [first, second] = await readCanvasPictures(page);
	const firstIsDescribed = first?.ariaLabel === DESCRIBED_ALT_TEXT;
	return firstIsDescribed
		? { described: first ?? EMPTY_FACTS, decorative: second ?? EMPTY_FACTS }
		: { described: second ?? EMPTY_FACTS, decorative: first ?? EMPTY_FACTS };
}

test.describe('picture accessibility parity', () => {
	test('a described picture gets role=img and its alt text as the label, in every binding', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.described.role !== 'img') {
				problems.push(`role is "${value.described.role}", expected "img"`);
			}
			if (value.described.ariaLabel !== DESCRIBED_ALT_TEXT) {
				problems.push(
					`aria-label is ${JSON.stringify(value.described.ariaLabel)}, expected ${JSON.stringify(DESCRIBED_ALT_TEXT)}`,
				);
			}
			if (value.described.ariaHidden === 'true') {
				problems.push('aria-hidden="true" on a picture that has real alt text');
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});

	test('a decorative picture is hidden from assistive tech, in every binding', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.decorative.ariaHidden !== 'true') {
				problems.push(`aria-hidden is "${value.decorative.ariaHidden}", expected "true"`);
			}
			if (value.decorative.role) {
				problems.push(`role is "${value.decorative.role}", expected no role at all`);
			}
			if (value.decorative.ariaLabel) {
				problems.push(`aria-label is "${value.decorative.ariaLabel}", expected empty`);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});

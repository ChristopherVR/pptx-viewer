/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for issue #149, run identically against every framework
 * demo.
 *
 * The reporter compared the issue #130/#131 deck against PowerPoint again and
 * found the word wrap had swapped failure modes between releases: text that
 * used to break a word LATE now broke a word EARLY. Both are the same
 * underlying thing, a text measurement that disagrees with PowerPoint's.
 *
 * PowerPoint lays out with GDI-compatible metrics, snapping every glyph advance
 * to 1/8 point; the browser uses unrounded advances. Per glyph the two differ by
 * up to 1/12 px in EITHER direction, so over a line the disagreement can land
 * either way: COM `BoundWidth` ground truth over this deck has the browser
 * measuring anywhere from 1.07% narrow to 0.28% wide. The first fix applied one
 * flat positive tracking to every run, which is roughly the middle of that
 * range - it tipped the late breaks the right way and pushed every already-wide
 * string over its column, which is what the reporter then saw.
 *
 * The runs now carry a tracking measured from their own characters, so these
 * three pin both directions at once on the same deck:
 *
 *  1. Slide 3's "Explore solution" button (Arial Bold 10pt in a 105px column,
 *     0.8px of slack) stays on ONE line.
 *  2. Slide 12's "Secure Data Movement" chip (Arial Bold 11pt in a 161.5px
 *     column, 0.12px of slack) stays on ONE line.
 *  3. Slide 13's first bullet still breaks after "compositis", the late break
 *     the flat tracking was introduced for (issue #131). This is the constraint
 *     that stops "fix #149" being spelt "revert #131".
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';
import { visualLines } from './support/text-runs';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)),
);

/** 1-based slide numbers, named for what they demonstrate. */
const SLIDE = {
	/** Carries the "Explore solution" button and a "Secure Data Movement" label. */
	callToAction: 3,
	/** Carries the narrow "Secure Data Movement" header chip. */
	headerChip: 12,
	/** Carries the bulleted panel whose first bullet breaks knife-edge. */
	bulletPanel: 13,
} as const;

/** The deck is 5 MB with a real video; give the initial parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(900);
}

test.describe('issue #149 - word wrap matches PowerPoint in both directions', () => {
	test('a button label PowerPoint keeps on one line does not wrap', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.callToAction);

		// COM ground truth: the shape's text column is 104.99px and PowerPoint
		// measures "Explore solution" at 104.17px, so it fits with 0.8px to
		// spare. A flat +0.003em over 16 characters adds ~0.64px of that back and
		// the browser broke the label into "Explore" / "solution".
		// The button is a hyperlink, so its element also carries a tooltip; assert
		// on the label's own lines rather than on the element's full line set.
		const lines = await visualLines(page, 'Explore solution');
		expect(lines, 'the label is one line, as PowerPoint draws it').toContain('Explore solution');
		expect(lines, 'the label did not break after "Explore"').not.toContain('Explore');
	});

	test('a header chip sized to its own text does not wrap', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.headerChip);

		// The tightest fit in the deck: a 161.46px column against PowerPoint's
		// own 161.34px measurement, 0.12px of slack. Nothing but a measurement
		// that agrees with PowerPoint's keeps this on one line.
		const lines = await visualLines(page, 'Secure Data Movement');
		expect(lines, 'the chip is one line, as PowerPoint draws it').toContain('Secure Data Movement');
		expect(lines, 'the chip did not break after "Data"').not.toContain('Secure Data');
	});

	test('a knife-edge bullet still breaks where PowerPoint breaks it', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.bulletPanel);

		// The opposite direction, and the reason a plain revert is not the fix:
		// here the browser measures NARROWER than PowerPoint, so left alone it
		// squeezes "synephebos" onto the first line (issue #131's last delta).
		const lines = await visualLines(page, 'Summis');
		const first = lines.findIndex((line) => line.includes('Summis'));
		expect(first, 'found the Summis bullet').toBeGreaterThanOrEqual(0);
		expect(lines[first], `line 1 breaks after "compositis" (got "${lines[first]}")`).toMatch(
			/compositis$/u,
		);
		expect(
			lines[first + 1] ?? '',
			`line 2 starts at "synephebos" (got "${lines[first + 1]}")`,
		).toMatch(/^synephebos/u);
	});
});

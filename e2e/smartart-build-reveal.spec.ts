/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `p:bldDgm` per-index SmartArt (diagram) build reveal, run identically
 * against every framework demo.
 *
 * The fixture (`smartart-build-reveal.pptx`, `e2e/fixtures/generate-smartart-
 * build-fixture.ts`) authors THREE discrete click steps, each carrying a
 * `p:spTgt/p:graphicEl/p:dgm/@id` naming the exact SmartArt data-model node it
 * reveals, in REVERSE node-list order (Gamma, then Beta, then Alpha - see the
 * generator's module doc for why a real PowerPoint COM-authored deck could not
 * be used here). This proves the AUTHORED-INDEX reveal path
 * (`diagram-reveal-descriptor`'s `resolveDiagramRevealDescriptor`, consumed by
 * `diagram-build`'s `resolveRevealedSmartArtNodes` /
 * `resolveRevealedDrawingShapes`) rather than the click-count leading-prefix
 * fallback: a count-based reveal would show "Alpha" first (the first node in
 * document order); the correct, authored reveal shows "Gamma" first.
 *
 * Flakiness posture matches `animation-builds-color.spec.ts`: timing-sensitive
 * assertions use `expect.poll`, never a fixed `waitForTimeout` on the
 * pass/fail path, and navigation advances until an anchor title is visible
 * rather than counting keypresses.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/smartart-build-reveal.pptx', import.meta.url)),
);

const TITLE = 'SmartArt Build Reveal Slide';

/**
 * The running show's own stage. Every binding stamps it, and scoping to it is
 * not optional: the editor canvas and the slide rail stay mounted behind the
 * show and render the SAME SmartArt (every node, no build state) at their own
 * scale, so an unscoped `[data-smartart-node-id]` count reads a thumbnail.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

async function enterPresentation(page: Page): Promise<void> {
	const slideShowButtons = page.getByRole('button', { name: /^slide show$/iu });
	if ((await slideShowButtons.count()) > 0) {
		await slideShowButtons.last().click();
		return;
	}
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.click();
}

async function openInPresentMode(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-element-id]').filter({ hasText: TITLE }).first().waitFor();
	await enterPresentation(page);
	await page.locator(SHOW_STAGE).first().waitFor();
	await page.waitForTimeout(700);
}

/**
 * Advance one click, the way a presenter does: after the previous step's
 * entrance animations have finished. PowerPoint's main sequence is authored
 * `p:seq/@nextAc="seek"`, so a click that lands while a step is still animating
 * fast-forwards THAT step instead of starting the next one; pressing on a fixed
 * short cadence therefore swallowed a click on any binding that honours seek.
 */
async function advance(page: Page): Promise<void> {
	await expect
		.poll(
			() =>
				page
					.locator(SHOW_STAGE)
					.first()
					.evaluate(
						(stage) =>
							stage.getAnimations({ subtree: true }).filter((a) => a.playState === 'running')
								.length,
					),
			{ timeout: 5_000 },
		)
		.toBe(0);
	await page.keyboard.press('PageDown');
	await page.waitForTimeout(250);
}

/** Count of on-stage nodes carrying `text` (the SmartArt reveal removes an
 * unrevealed node from the render output entirely, so presence IS the
 * reveal signal - no CSS-visibility polling needed). Scoped to the show
 * stage: see {@link SHOW_STAGE}. */
function revealedNodeCount(page: Page, text: string): Promise<number> {
	return page
		.locator(SHOW_STAGE)
		.first()
		.locator('[data-smartart-node-id]')
		.filter({ hasText: text })
		.count();
}

test.describe('staged SmartArt (p:bldDgm) per-node build playback', () => {
	test('reveals nodes in the AUTHORED reverse order, not click-count document order', async ({
		page,
	}) => {
		await openInPresentMode(page);
		await expect(
			page.locator(SHOW_STAGE).first().locator('[data-element-id]').filter({ hasText: TITLE }),
		).toBeVisible();

		// Before the first click: none of the three nodes have appeared yet.
		await expect.poll(() => revealedNodeCount(page, 'Alpha')).toBe(0);
		await expect.poll(() => revealedNodeCount(page, 'Beta')).toBe(0);
		await expect.poll(() => revealedNodeCount(page, 'Gamma')).toBe(0);

		// Click 1 reveals Gamma ONLY - the authored reveal, not the
		// count-based leading-prefix guess (which would show Alpha).
		await advance(page);
		await expect.poll(() => revealedNodeCount(page, 'Gamma')).toBeGreaterThan(0);
		await expect.poll(() => revealedNodeCount(page, 'Alpha')).toBe(0);
		await expect.poll(() => revealedNodeCount(page, 'Beta')).toBe(0);

		// Click 2 reveals Beta too (Gamma stays revealed).
		await advance(page);
		await expect.poll(() => revealedNodeCount(page, 'Gamma')).toBeGreaterThan(0);
		await expect.poll(() => revealedNodeCount(page, 'Beta')).toBeGreaterThan(0);
		await expect.poll(() => revealedNodeCount(page, 'Alpha')).toBe(0);

		// Click 3 reveals Alpha - now every node is on screen.
		await advance(page);
		await expect.poll(() => revealedNodeCount(page, 'Alpha')).toBeGreaterThan(0);
		await expect.poll(() => revealedNodeCount(page, 'Beta')).toBeGreaterThan(0);
		await expect.poll(() => revealedNodeCount(page, 'Gamma')).toBeGreaterThan(0);
	});
});

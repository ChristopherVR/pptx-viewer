/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Box and Cube used to be byte-identical: `slide-transition-cinematic.ts`
 * literally reused Cube's `pptx-tr-cube-*` keyframes for Box (`p14:prism` with
 * no flags vs `isInverted="1"`). COM `CreateVideo` frame extraction against a
 * real PowerPoint-authored deck showed they are visually distinct (the two
 * faces stay flush along one hinge for Cube; they separate with a depth gap
 * for Box), so `slide-transition-box.ts` now gives Box its own keyframes.
 *
 * This spec is the framework-neutral regression: playing each transition
 * produces a DIFFERENT `transform` on the outgoing transition layer partway
 * through playback, in every binding, from a fixture loaded fresh (not
 * authored live in this session) so it exercises the real save/load
 * round-trip like `animations-transitions.spec.ts` does.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	BOX_CUBE_TRANSITION_DURATION_MS,
	BOX_CUBE_TRANSITION_SLIDES as SLIDES,
} from './fixtures/generate-box-cube-transition-fixture';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/box-cube-transition.pptx', import.meta.url)),
);

/** Same margin every binding's overlay adds past the raw duration (see
 * `animations-transitions.spec.ts`). */
const SETTLE_BUFFER_MS = 50;
const POLL_SLACK_MS = 2000;
const TRANSITION_SETTLE_TIMEOUT_MS =
	BOX_CUBE_TRANSITION_DURATION_MS + SETTLE_BUFFER_MS + POLL_SLACK_MS;
/** Sampled well inside the transition window (a quarter of the way through)
 * so the poll below reliably observes a non-identity transform before the
 * overlay tears down, without racing completion. */
const MID_TRANSITION_SAMPLE_MS = Math.round(BOX_CUBE_TRANSITION_DURATION_MS / 4);

/** Same "pick the on-screen, largest-by-area match" technique as
 * `animations-transitions.spec.ts` - presentation mode keeps thumbnail-rail
 * and off-screen duplicates around that a plain text match would also hit. */
async function primaryMatch(page: Page, locator: Locator, minAreaPx = 5000): Promise<Locator> {
	const viewport = page.viewportSize();
	const token = `primary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const found = await locator.evaluateAll(
		(elements, args) => {
			let best: Element | undefined;
			let bestArea = -1;
			for (const element of elements) {
				const box = element.getBoundingClientRect();
				const onScreen =
					!args.viewport ||
					(box.right > 0 &&
						box.left < args.viewport.width &&
						box.bottom > 0 &&
						box.top < args.viewport.height);
				const area = box.width * box.height;
				if (onScreen && area >= args.minAreaPx && area > bestArea) {
					best = element;
					bestArea = area;
				}
			}
			best?.setAttribute('data-e2e-primary-match', args.token);
			return Boolean(best);
		},
		{ viewport, minAreaPx, token },
	);
	return found
		? page.locator(`[data-e2e-primary-match="${token}"]`)
		: page.locator(`[data-e2e-primary-match="${token}-missing"]`);
}

/** Load the fixture and enter presentation mode, landing on slide 1. */
async function openInPresentMode(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-element-id]').filter({ hasText: SLIDES.first }).first().waitFor();
	const slideShowButtons = page.getByRole('button', { name: /^slide show$/iu });
	if ((await slideShowButtons.count()) > 0) {
		await slideShowButtons.last().click();
	} else {
		await page
			.getByRole('button', { name: /present/iu })
			.first()
			.click();
	}
	await page.waitForTimeout(700);
}

async function advance(page: Page): Promise<void> {
	await page.keyboard.press('PageDown');
}

async function slideTitle(page: Page, title: string): Promise<Locator> {
	return primaryMatch(page, page.locator('[data-element-id]').filter({ hasText: title }));
}

/**
 * Advance into a transition-bearing slide and sample the outgoing layer's
 * inline `transform` shortly after the CSS animation starts (before it
 * settles). Returns the sampled matrix string, or `''` if the overlay tore
 * down before the sample (which would itself fail the caller's assertions).
 */
async function sampleMidTransitionTransform(page: Page, nextTitle: string): Promise<string> {
	const overlay = page.locator('[data-pptx-transition-overlay]');
	await advance(page);
	await expect(overlay).toBeVisible();
	const layers = overlay.locator('[data-pptx-transition-layer]');
	await expect(layers).not.toHaveCount(0);

	await page.waitForTimeout(MID_TRANSITION_SAMPLE_MS);
	const transforms = await layers.evaluateAll((els) =>
		els.map((el) => getComputedStyle(el as HTMLElement).transform),
	);

	await expect(await slideTitle(page, nextTitle)).toBeVisible();
	await expect(overlay).toHaveCount(0, { timeout: TRANSITION_SETTLE_TIMEOUT_MS });

	// A real 3-D keyframe (perspective + rotate/translate) always produces a
	// 3-D (16-value `matrix3d`) or at least a non-identity 2-D matrix partway
	// through playback; `none`/the identity matrix means nothing was applied.
	// Join every layer's value (sorted for stable comparison) rather than just
	// the first, so the comparison covers both the outgoing and incoming layer.
	return transforms
		.filter((value) => value !== '' && value !== 'none')
		.sort()
		.join('|');
}

test.describe('box vs cube transition parity', () => {
	test('cube and box apply different transforms mid-playback, not a reused pair', async ({
		page,
	}) => {
		await openInPresentMode(page);
		await expect(await slideTitle(page, SLIDES.first)).toBeVisible();

		const cubeTransform = await sampleMidTransitionTransform(page, SLIDES.cube);
		expect(cubeTransform, 'cube applies a real (non-identity) transform mid-playback').not.toBe('');

		const boxTransform = await sampleMidTransitionTransform(page, SLIDES.box);
		expect(boxTransform, 'box applies a real (non-identity) transform mid-playback').not.toBe('');

		expect(
			boxTransform,
			"box must not reuse cube's exact mid-transition transform (they are visually distinct in PowerPoint)",
		).not.toBe(cubeTransform);
	});
});

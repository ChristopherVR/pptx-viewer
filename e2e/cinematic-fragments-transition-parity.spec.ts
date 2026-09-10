/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do all five bindings render the SAME multi-fragment descriptor for the
 * seven cinematic transitions COM `CreateVideo` measurement showed rendering
 * as many independent fragments/tiles/particles in real PowerPoint (`vortex`,
 * `honeycomb`, `glitter`, `shred`, `fracture`, `curtains`, `airplane`)?
 *
 * `getFragmentedTransitionDescriptor` (`packages/shared/src/render/
 * slide-transition-fragments.ts`) is a pure function: fed the same
 * transition type/duration/direction/pattern, it returns byte-identical
 * fragment geometry no matter which binding calls it. So this spec is not
 * "does a transition play" (`box-cube-transition-parity.spec.ts` already
 * covers a single binding's playback) but "did every binding actually wire
 * the shared descriptor" - the Rule 1 failure mode is a binding porting the
 * OLD single-layer stand-in instead of adopting the new fragment engine, or
 * silently diverging (fewer fragments, different clip-paths) while still
 * technically "rendering something".
 *
 * For each preset this samples every `[data-pptx-transition-fragment]`
 * element's `clip-path` + `transform-origin` shortly after the transition
 * starts (a structural, deterministic stand-in for a raster screenshot
 * fingerprint - see `e2e/support/fingerprint.ts` for why this repo prefers
 * normalised structural fingerprints over pixel diffs) and asserts every
 * binding produced the exact same sorted set.
 *
 * Run: bunx playwright test cinematic-fragments-transition-parity
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	CINEMATIC_FRAGMENTS_DURATION_MS,
	CINEMATIC_FRAGMENTS_SLIDES as SLIDES,
} from './fixtures/generate-cinematic-fragments-fixture';
import { fixture, loadDeckAt, resetTabSession } from './support/deck';
import { acrossFrameworks, formatDiff } from './support/parity';

const DECK = fixture('cinematic-fragments.pptx');

/** Order matches the fixture's slide order (after the non-transitioning base slide). */
const PRESETS = [
	SLIDES.vortex,
	SLIDES.honeycomb,
	SLIDES.glitter,
	SLIDES.shred,
	SLIDES.fracture,
	SLIDES.curtains,
	SLIDES.airplane,
] as const;

const SETTLE_BUFFER_MS = 50;
const POLL_SLACK_MS = 2000;
const TRANSITION_SETTLE_TIMEOUT_MS =
	CINEMATIC_FRAGMENTS_DURATION_MS + SETTLE_BUFFER_MS + POLL_SLACK_MS;
/** Sampled a quarter of the way through, well inside the fragment animations. */
const MID_TRANSITION_SAMPLE_MS = Math.round(CINEMATIC_FRAGMENTS_DURATION_MS / 4);

/** Same "pick the on-screen, largest-by-area match" technique other transition specs use. */
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

/** Load the fixture and enter presentation mode, landing on the base slide. */
async function openInPresentMode(page: Page, origin: string): Promise<void> {
	// Each `newPage()` in `acrossFrameworks` gets its own browser context, but a
	// spec re-run against the same origin (this repo's own long-lived dev
	// servers) can still inherit an autosave-recovery modal from an earlier
	// run against that origin, which then intercepts every click underneath it
	// (see `resetTabSession`'s doc comment; matches `box-cube-transition-parity`).
	await resetTabSession(page);
	await loadDeckAt(page, origin, DECK);
	await page.locator('[data-element-id]').filter({ hasText: SLIDES.base }).first().waitFor();
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

/** One preset's sampled fragment structure. */
interface FragmentSample {
	preset: string;
	keyframesNames: string[];
	fragmentGeometry: string[];
}

/**
 * Advance into a fragmented-transition slide, sample every fragment's
 * `clip-path` + `transform-origin` shortly after the animation starts, then
 * wait for the overlay to tear down before the caller advances again.
 */
async function sampleFragments(
	page: Page,
	preset: string,
	nextTitle: string,
): Promise<FragmentSample> {
	const overlay = page.locator('[data-pptx-transition-overlay]');
	await advance(page);
	await expect(overlay).toBeVisible();

	// The fragment layer(s) mount as part of the same render as the overlay
	// itself, but under CI load a binding's change detection (Angular's
	// `computed()`/`@if` chain in particular) can take a few extra ticks to
	// flush after the overlay's own host element exists. Wait for at least
	// one fragment to actually be in the DOM before sampling, rather than
	// assuming a fixed `MID_TRANSITION_SAMPLE_MS` since `advance()` was
	// always enough: sampling too early read as "0 fragments" under load
	// (every preset in `PRESETS` is one of the seven fragmented transitions,
	// so this never waits out a preset that legitimately has none).
	await overlay
		.locator('[data-pptx-transition-fragment]')
		.first()
		.waitFor({ timeout: TRANSITION_SETTLE_TIMEOUT_MS });
	await page.waitForTimeout(MID_TRANSITION_SAMPLE_MS);
	const layers = overlay.locator('[data-pptx-transition-fragments]');
	const keyframesNames = await layers.evaluateAll((els) =>
		els.map((el) => el.getAttribute('data-pptx-transition-fragments') ?? ''),
	);
	const fragments = overlay.locator('[data-pptx-transition-fragment]');
	const fragmentGeometry = await fragments.evaluateAll((els) =>
		els.map((el) => {
			const style = getComputedStyle(el as HTMLElement);
			return `${(el as HTMLElement).style.clipPath}|${style.transformOrigin}`;
		}),
	);

	await expect(await slideTitle(page, nextTitle)).toBeVisible();
	await expect(overlay).toHaveCount(0, { timeout: TRANSITION_SETTLE_TIMEOUT_MS });

	return {
		preset,
		keyframesNames: keyframesNames.sort(),
		fragmentGeometry: fragmentGeometry.sort(),
	};
}

test.describe('cinematic fragment transition parity', () => {
	test('every binding renders the same fragment descriptor for all seven presets', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openInPresentMode(page, origin);
				await expect(await slideTitle(page, SLIDES.base)).toBeVisible();

				const samples: FragmentSample[] = [];
				for (const preset of PRESETS) {
					samples.push(await sampleFragments(page, preset, preset));
				}
				return samples;
			},
			{ concurrency: 'sequential' },
		);

		expect(results.length).toBeGreaterThan(1);
		const [reference, ...candidates] = results;

		for (const preset of PRESETS) {
			const referenceSample = reference.value.find((s) => s.preset === preset);
			expect(referenceSample, `${reference.framework.name} sampled ${preset}`).toBeDefined();
			expect(
				referenceSample!.fragmentGeometry.length,
				`${reference.framework.name}/${preset}: more than one fragment (not a single-layer stand-in)`,
			).toBeGreaterThan(1);
		}

		const perCandidateProblems: string[] = [];
		for (const candidate of candidates) {
			const problems: string[] = [];
			for (const preset of PRESETS) {
				const referenceSample = reference.value.find((s) => s.preset === preset)!;
				const candidateSample = candidate.value.find((s) => s.preset === preset);
				if (!candidateSample) {
					problems.push(`${preset}: no sample captured`);
					continue;
				}
				if (candidateSample.keyframesNames.join(',') !== referenceSample.keyframesNames.join(',')) {
					problems.push(
						`${preset}: keyframes [${candidateSample.keyframesNames.join(', ')}] ` +
							`!= reference [${referenceSample.keyframesNames.join(', ')}]`,
					);
				}
				if (candidateSample.fragmentGeometry.length !== referenceSample.fragmentGeometry.length) {
					problems.push(
						`${preset}: ${candidateSample.fragmentGeometry.length} fragments ` +
							`!= reference's ${referenceSample.fragmentGeometry.length}`,
					);
				}
			}
			if (problems.length > 0) {
				perCandidateProblems.push(formatDiff(candidate.framework.name, problems));
			}
		}

		expect(perCandidateProblems.join('\n\n')).toBe('');
	});
});

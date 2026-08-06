/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings paint the same slide?
 *
 * Every other spec in this directory asks whether a binding works. This one
 * asks whether it agrees, which is a different and mostly unguarded question:
 * a viewer can pass all of its own tests while rendering a title two points
 * smaller, a shape three percent to the left, or a paragraph in the wrong
 * weight, and nothing fails. Those are precisely the drifts that have shipped
 * here before.
 *
 * The comparison is scale-free (see `support/fingerprint`), so it survives the
 * demos fitting the slide to different chrome, and it is stated once: the
 * harness replays it against React plus whichever bindings this Playwright
 * project owns. Every slide of each deck is fingerprinted, not just the first:
 * the table slide, the chart slide and the media slides are exactly where the
 * bindings have historically drifted.
 *
 * Run: bunx playwright test slide-render-parity
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { fingerprintSlide } from './support/fingerprint';
import type { SlideFingerprint } from './support/fingerprint';
import { acrossFrameworks, diffSlides, formatDiff, splitReference } from './support/parity';
import { applyExclusions } from './support/parity-exclusions';
import type { ParityExclusion } from './support/parity-exclusions';

test.use({ viewport: { width: 1440, height: 900 } });

/** A deck under comparison, and which of its slides to fingerprint. */
interface DeckUnderComparison {
	file: string;
	/** 1-based slide numbers to fingerprint. */
	slides: readonly number[];
	/** Slide count shown in the "N of M" indicator, used to await navigation. */
	totalSlides: number;
	/** Per-test timeout: big decks cost one long load per binding. */
	timeout: number;
	/** Waits used while loading; the media deck needs far more than the default. */
	loadTimeout: number;
}

const MEDIA_DECK = 'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx';

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i + 1);

const DECKS: readonly DeckUnderComparison[] = [
	// 7 slides covering text, tables, charts and images.
	{
		file: 'sample-deck.pptx',
		slides: range(7),
		totalSlides: 7,
		timeout: 180_000,
		loadTimeout: 30_000,
	},
	// 7 slides of typography edge cases.
	{
		file: 'text-features.pptx',
		slides: range(7),
		totalSlides: 7,
		timeout: 180_000,
		loadTimeout: 30_000,
	},
	// Real-world 36.8MB media deck: photos everywhere, video on 11, audio on 12.
	// The media-bearing and image-heavy slides are the ones fingerprinted; they
	// are the only e2e coverage of <img>/<video>/<audio> content parity.
	{
		file: MEDIA_DECK,
		slides: [1, 4, 11, 12],
		totalSlides: 12,
		timeout: 420_000,
		loadTimeout: 120_000,
	},
];

/**
 * Known, documented cross-binding divergences (parity debt).
 *
 * Empty, and meant to stay that way. Every divergence this spec found when it
 * grew from slide 1 of two decks to every slide of three has been fixed in the
 * product: the shared table default font and font size, the layout-element
 * marker contract, the Svelte cell-whitespace text artefact, the fill-less
 * `<a:ln>` picture frame, and (most recently) stroke-only "open" preset
 * geometry - `<a:prstGeom prst="line"/>` and the arc/connector family - which
 * four bindings painted as a CSS border on the element box, i.e. as a rectangle.
 * All five now stroke it from the shared `buildStrokeOutline`. Each has its own
 * unit tests; see `support/parity-exclusions` for the policy if a new one ever
 * has to be added.
 */
const KNOWN_DIVERGENCES: readonly ParityExclusion[] = [];

/** As `support/deck`'s loader, but with load waits sized for very large decks. */
async function loadDeckSlowlyAt(
	page: Page,
	origin: string,
	fixturePath: string,
	timeout: number,
): Promise<void> {
	await page.goto(origin);
	await page.locator('#file-input').setInputFiles(fixturePath);
	await slideStage(page).waitFor({ timeout });
	await page
		.locator('[data-pptx-viewport] [data-element-id]')
		.first()
		.waitFor({ state: 'attached', timeout });
	await page.waitForFunction(() => document.fonts.status === 'loaded');
}

/** Switch to `slide` and wait until its content (charts included) is painted. */
async function gotoSlide(page: Page, slide: number, totalSlides: number): Promise<void> {
	if (slide > 1) {
		await thumbnail(page, slide).click();
		// The slide indicator is the only neutral "navigation done" signal; \b
		// keeps "2 of 12" from matching inside "12 of 12".
		await page
			.getByText(new RegExp(`\\b${slide} of ${totalSlides}\\b`, 'u'))
			.first()
			.waitFor();
	}
	// Charts mount their <svg> after the slide stage paints; wait for the ink,
	// not just the frame, or the two sides of the diff race the renderer.
	await page.waitForTimeout(250);
	const charts = page.locator('[aria-roledescription="slide"] [aria-roledescription="chart"]');
	if ((await charts.count()) > 0) {
		await charts.locator('svg').first().waitFor({ timeout: 15_000 });
	}
	await page.waitForTimeout(250);
}

test.describe('cross-binding slide rendering', () => {
	for (const deck of DECKS) {
		test(`${deck.file}: every fingerprinted slide is painted identically everywhere`, async ({
			browser,
		}, testInfo) => {
			test.setTimeout(deck.timeout);

			const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
				if (deck.loadTimeout > 30_000) {
					await loadDeckSlowlyAt(page, origin, fixture(deck.file), deck.loadTimeout);
				} else {
					await loadDeckAt(page, origin, fixture(deck.file));
				}
				const perSlide: SlideFingerprint[] = [];
				for (const slide of deck.slides) {
					await gotoSlide(page, slide, deck.totalSlides);
					perSlide.push(await fingerprintSlide(page));
				}
				return perSlide;
			});

			const { reference, candidates } = splitReference(results);
			expect(
				reference.value.every((slideResult) => slideResult.elements.length > 0),
				'the reference binding rendered an empty slide',
			).toBe(true);

			const matched = new Set<ParityExclusion>();
			const problems: string[] = [];
			for (const candidate of candidates) {
				const perBinding: string[] = [];
				deck.slides.forEach((slide, index) => {
					const where = `${deck.file} slide ${slide}`;
					const raw = diffSlides(
						reference.value[index],
						candidate.value[index] ?? { aspect: 0, elements: [] },
					).map((problem) => `${where}: ${problem}`);
					perBinding.push(
						...applyExclusions(
							raw,
							{ binding: candidate.framework.name, where },
							KNOWN_DIVERGENCES,
							matched,
						),
					);
				});
				if (perBinding.length > 0) {
					problems.push(formatDiff(candidate.framework.name, perBinding, 40));
				}
			}

			expect(problems.join('\n\n')).toBe('');
		});
	}
});

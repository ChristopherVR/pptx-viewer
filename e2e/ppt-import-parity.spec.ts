/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Legacy .ppt (PowerPoint 97-2003) import, and its parity with .pptx.
 *
 * Core auto-detects the OLE compound-file container on load and converts the
 * binary deck through the regular pptx pipeline, so a `.ppt` should open from
 * the same `#file-input` as everything else and paint the same slide as its
 * `.pptx` twin (both fixtures were exported from the same deck via PowerPoint
 * COM). Three questions, all framework-neutral:
 *
 *  1. Does a `.ppt` open at all: right slide count, known text rendered, and
 *     the demo's file input actually advertising the extension?
 *  2. Cross-FORMAT parity: does slide 1 loaded from `sample-deck.ppt`
 *     fingerprint identically to slide 1 loaded from `sample-deck.pptx` in the
 *     SAME binding? This reuses the cross-binding fingerprint + diff harness,
 *     re-keyed by content because the two formats share no `data-element-id`s
 *     (see `support/format-parity`).
 *  3. Does the typography-edge-case deck (`text-features.ppt`) survive the
 *     import well enough to render its slide-1 text?
 *
 * Run: bunx playwright test ppt-import-parity
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { elementWithText, fixture, loadDeck } from './support/deck';
import { fingerprintSlide } from './support/fingerprint';
import { diffFormats } from './support/format-parity';
import { applyExclusions } from './support/parity-exclusions';
import type { ParityExclusion } from './support/parity-exclusions';

test.use({ viewport: { width: 1440, height: 900 } });

/** Slide count of the sample deck, identical in both formats. */
const SAMPLE_DECK_SLIDES = 7;

/** Slide-1 subtitle of the sample deck: present in both fixture formats. */
const SAMPLE_TEXT_PROBE = 'Product Overview';

/** Slide-1 probe of the typography deck: a run the binary importer must keep. */
const TEXT_FEATURES_PROBE = 'Double underline';

/**
 * Known, documented .ppt-import limitations (NOT parity bugs).
 *
 * The binary format predates DrawingML, so a handful of fills and effects have
 * no lossless mapping and the importer degrades them deliberately. Each entry
 * names one such degradation; delete it if the importer ever learns the
 * lossless mapping. Everything else (positions, text, solid fills) must match
 * the .pptx twin exactly within the shared tolerance.
 */
const PPT_IMPORT_LIMITATIONS: readonly ParityExclusion[] = [
	// The .pptx theme names Calibri; the binary format has no fontScheme, so the
	// importer approximates both theme fonts as the FIRST FontEntity in the
	// deck's font collection (core/ppt/pptx/master-writer.ts), which on this
	// deck is Segoe UI. Theme-font runs therefore resolve to a Segoe UI stack
	// instead of the Calibri stack. Geometry, text and colours still match.
	{
		where: 'sample-deck slide 1',
		pattern: /font family is "segoe ui, helvetica neue, arial, sans-serif"/u,
		why: '.ppt has no fontScheme; the importer promotes the first binary FontEntity to both theme fonts',
	},
];

/** Load `fixtureName` from the landing page and wait for slide 1 to paint. */
async function openPpt(page: Page, fixtureName: string): Promise<void> {
	await loadDeck(page, fixture(fixtureName));
	// Let late-mounting content (images decoded off the converted deck) settle
	// before anything is measured, mirroring the cross-binding harness.
	await page.waitForTimeout(250);
}

test.describe('legacy .ppt import', () => {
	test('sample-deck.ppt opens from the file input with all slides', async ({ page }) => {
		// The wiring under test, not just the loader: the landing input must
		// actually advertise .ppt, or real users could never select the file
		// Playwright injects past the filter. Checked before the upload: the
		// landing dropzone (and its input) unmounts once a deck is open.
		await page.goto('/');
		await expect(page.locator('#file-input')).toHaveAttribute('accept', /(?:^|,)\.ppt(?:,|$)/u);

		await openPpt(page, 'sample-deck.ppt');
		await expect(
			page.getByText(new RegExp(`\\b1 of ${SAMPLE_DECK_SLIDES}\\b`, 'u')).first(),
		).toBeVisible();
		await expect(elementWithText(page, SAMPLE_TEXT_PROBE)).toBeVisible();
	});

	test('slide 1 renders identically from .ppt and from .pptx', async ({ page }) => {
		test.setTimeout(120_000);

		await openPpt(page, 'sample-deck.ppt');
		const fromPpt = await fingerprintSlide(page);
		expect(fromPpt.elements.length, 'the .ppt deck rendered an empty slide').toBeGreaterThan(0);

		// Fresh page state, same binding, same slide, canonical format.
		await openPpt(page, 'sample-deck.pptx');
		const fromPptx = await fingerprintSlide(page);

		const matched = new Set<ParityExclusion>();
		const problems = applyExclusions(
			diffFormats(fromPptx, fromPpt),
			{ binding: 'cross-format', where: 'sample-deck slide 1' },
			PPT_IMPORT_LIMITATIONS,
			matched,
		);
		expect(problems.join('\n')).toBe('');

		// A limitation entry that no longer matches anything is stale: the
		// importer improved, so the exclusion must be deleted, not kept.
		const unmatched = PPT_IMPORT_LIMITATIONS.filter((exclusion) => !matched.has(exclusion));
		expect(
			unmatched.map((exclusion) => exclusion.why).join('\n'),
			'stale .ppt-limitation exclusions',
		).toBe('');
	});

	test('text-features.ppt opens and renders its slide-1 text', async ({ page }) => {
		await openPpt(page, 'text-features.ppt');
		await expect(elementWithText(page, TEXT_FEATURES_PROBE)).toBeVisible();
	});
});

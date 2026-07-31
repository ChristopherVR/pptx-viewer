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
 * project owns.
 *
 * Run: bunx playwright test slide-render-parity
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { fingerprintSlide } from './support/fingerprint';
import { acrossFrameworks, collectParityProblems, splitReference } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const SAMPLE = fixture('sample-deck.pptx');
const TEXT_FEATURES = fixture('text-features.pptx');

test.describe('cross-binding slide rendering', () => {
	test('slide 1 of the sample deck is laid out identically everywhere', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			await slideStage(page).waitFor();
			return fingerprintSlide(page);
		});

		const { reference } = splitReference(results);
		expect(reference.value.elements.length).toBeGreaterThan(0);
		expect(collectParityProblems(results).join('\n\n')).toBe('');
	});

	test('the text-features deck renders with the same typography everywhere', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, TEXT_FEATURES);
			await slideStage(page).waitFor();
			return fingerprintSlide(page);
		});

		expect(collectParityProblems(results).join('\n\n')).toBe('');
	});
});

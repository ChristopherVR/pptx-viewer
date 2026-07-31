/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does every binding resolve field runs, and against the right slide?
 *
 * An OOXML field run stores the value PowerPoint last displayed alongside the
 * field type, so a viewer that never resolves the field still renders
 * something: `Slide #` instead of `Slide 3`. Nothing looks broken, no element
 * is missing, and every geometry assertion still passes. One binding shipped
 * exactly that.
 *
 * Resolving against the wrong slide fails just as quietly. A viewer that
 * provides one field context built from the *active* slide prints that slide's
 * number and title on every thumbnail in the rail, so the whole pane reads
 * "Slide 3" while showing four different slides. Another binding shipped that.
 *
 * Both need a deck with several slides whose fields resolve to different
 * values, which is why this spec has its own fixture rather than reusing one:
 * on a single-slide deck, resolving against the wrong slide gives the right
 * answer by accident.
 *
 * Run: bunx playwright test field-substitution-parity
 */
import { expect, test } from '@playwright/test';

import {
	expectedFieldText,
	FIELD_SLIDE_TITLES,
} from './fixtures/generate-field-substitution-fixture';
import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks, formatDiff } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('field-substitution.pptx');

/** Collapsed text of the main-canvas stage. */
async function stageText(page: import('@playwright/test').Page): Promise<string> {
	return slideStage(page).evaluate((node) => (node.textContent ?? '').replace(/\s+/gu, ' ').trim());
}

/**
 * The slide number each thumbnail's own field runs resolved to.
 *
 * Read off the "Go to slide N" buttons rather than off slide stages: only some
 * bindings give a thumbnail the `aria-roledescription="slide"` contract, but
 * all five render the thumbnail's text inside its button.
 *
 * The digits are taken from after the word "Slide" so the leading slide-index
 * badge in the button is not mistaken for the field's value, and the match is
 * loose about what sits between so it holds both before and after the
 * field-position defect is fixed.
 */
async function thumbnailFieldNumbers(page: import('@playwright/test').Page): Promise<string[]> {
	const numbers: string[] = [];
	for (let slide = 1; slide <= FIELD_SLIDE_TITLES.length; slide += 1) {
		const text = ((await thumbnail(page, slide).textContent()) ?? '').replace(/\s+/gu, ' ');
		numbers.push(/Slide[^0-9]*(\d+)/u.exec(text)?.[1] ?? 'none');
	}
	return numbers;
}

/** Walk every slide, returning the canvas text of each. */
async function textPerSlide(page: import('@playwright/test').Page): Promise<string[]> {
	const perSlide: string[] = [];
	for (let slide = 1; slide <= FIELD_SLIDE_TITLES.length; slide += 1) {
		if (slide > 1) {
			await thumbnail(page, slide).click();
		}
		await expect.poll(() => stageText(page)).toContain(FIELD_SLIDE_TITLES[slide - 1]);
		perSlide.push(await stageText(page));
	}
	return perSlide;
}

test.describe('field substitution', () => {
	test('every binding resolves the slide-number field to its own slide', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, DECK);
			return textPerSlide(page);
		});

		const problems: string[] = [];
		for (const result of results) {
			const perBinding = result.value.flatMap((text, index) => {
				const number = String(index + 1);
				// Asserted on the resolved value alone, wherever the run ends up in the
				// paragraph, so this stays a substitution test rather than doubling as
				// the ordering test below. The fixture's literal runs contain no digits,
				// so any digit on screen came from the field.
				const found = text.includes(number);
				const perSlide: string[] = [];
				if (text.includes('#')) {
					perSlide.push(
						`slide ${index + 1}: the cached field literal "#" is still on screen ("${text}")`,
					);
				}
				if (!found) {
					perSlide.push(
						`slide ${index + 1}: no resolved slide number ${number} on screen ("${text}")`,
					);
				}
				return perSlide;
			});
			if (perBinding.length > 0) {
				problems.push(formatDiff(result.framework.name, perBinding));
			}
		}

		expect(problems.join('\n\n')).toBe('');
	});

	test('an inline field stays in the position it was authored in', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, DECK);
			return textPerSlide(page);
		});

		const problems: string[] = [];
		for (const result of results) {
			const perBinding = result.value.flatMap((text, index) => {
				const want = expectedFieldText(index + 1);
				return text.includes(want)
					? []
					: [`slide ${index + 1}: expected the canvas to read "${want}", got "${text}"`];
			});
			if (perBinding.length > 0) {
				problems.push(formatDiff(result.framework.name, perBinding));
			}
		}

		expect(problems.join('\n\n')).toBe('');
	});

	test('thumbnails resolve their own slide number, not the active one', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, DECK);
			// Move off slide 1 first: a binding that resolves every stage against the
			// active slide still looks correct while slide 1 is the active slide.
			await thumbnail(page, 3).click();
			await expect.poll(() => stageText(page)).toContain(FIELD_SLIDE_TITLES[2]);
			return thumbnailFieldNumbers(page);
		});

		const expected = FIELD_SLIDE_TITLES.map((_, index) => String(index + 1));
		const problems: string[] = [];
		for (const result of results) {
			if (result.value.join(',') !== expected.join(',')) {
				problems.push(
					formatDiff(result.framework.name, [
						`with slide 3 active, the thumbnails resolved to [${result.value.join(', ')}] ` +
							`instead of [${expected.join(', ')}]`,
					]),
				);
			}
		}

		expect(problems.join('\n\n')).toBe('');
	});
});

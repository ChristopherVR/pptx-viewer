/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * PowerPoint's East Asian line breaking in every binding: `hangingPunct="1"`
 * keeps an overflowing `。` on its line past the margin, `hangingPunct="0"`
 * wraps it with the character before it, and `eaLnBrk="0"` drops kinsoku so
 * a closing bracket may start a line (COM-verified; see
 * `packages/shared/src/render/text-east-asian-breaks.ts`).
 *
 * Each box is 4.6em wide with zero insets and the fifth character is the one
 * at issue. The spec reads character rectangles from DOM ranges, so it makes
 * no assumption about any binding's span structure, and it skips a box whose
 * font does not give the fullwidth advances the geometry relies on.
 *
 * Fixture: `cjk-line-breaking.pptx` (`generate-cjk-line-breaking-fixture.ts`).
 *
 * Run: bunx playwright test cjk-line-breaking
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { CJK_BREAK_BOXES } from './fixtures/generate-cjk-line-breaking-fixture';
import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('cjk-line-breaking.pptx');

interface CharBox {
	ch: string;
	left: number;
	right: number;
	top: number;
}

interface BoxLayout {
	boxRight: number;
	chars: CharBox[];
}

/** Every visible character's rectangle in the element whose text is `text`. */
async function measure(page: Page, texts: string[]): Promise<BoxLayout[]> {
	return page.evaluate((wanted) => {
		const strip = (value: string) => value.replaceAll(/[​⁠\s]/gu, '');
		// The main stage only: a filmstrip thumbnail renders the same text tiny.
		const root = document.querySelector('[data-pptx-viewport]') ?? document;
		const all = [...root.querySelectorAll<HTMLElement>('[data-element-id]')];
		return wanted.map((text) => {
			const host = all.find((el) => strip(el.textContent ?? '') === text);
			if (!host) {
				throw new Error(`no rendered element holds ${JSON.stringify(text)}`);
			}
			const chars: Array<{ ch: string; left: number; right: number; top: number }> = [];
			const range = document.createRange();
			const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const data = node.textContent ?? '';
				for (let i = 0; i < data.length; i++) {
					if (/[​⁠\s]/u.test(data[i])) {
						continue;
					}
					range.setStart(node, i);
					range.setEnd(node, i + 1);
					const rect = range.getBoundingClientRect();
					chars.push({ ch: data[i], left: rect.left, right: rect.right, top: rect.top });
				}
			}
			return { boxRight: host.getBoundingClientRect().right, chars };
		});
	}, texts);
}

async function readSlide(page: Page, origin: string): Promise<BoxLayout[]> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	await page.waitForTimeout(400);
	return measure(page, [
		CJK_BREAK_BOXES.hang.text,
		CJK_BREAK_BOXES.noHang.text,
		CJK_BREAK_BOXES.breakAnywhere.text,
	]);
}

/** Whether the font gave the first four characters (near) equal fullwidth advances. */
function fullwidth(layout: BoxLayout): boolean {
	const [a, b] = layout.chars;
	const em = b.left - a.left;
	return (
		em > 0 && layout.chars.slice(0, 4).every((c) => Math.abs(c.right - c.left - em) < em * 0.1)
	);
}

const sameLine = (a: CharBox, b: CharBox) => Math.abs(a.top - b.top) < 2;

test.describe('CJK line breaking', () => {
	test('every binding hangs 。 and drops kinsoku like PowerPoint', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const [hang, noHang, anywhere] = value;
			const problems: string[] = [];
			if (fullwidth(hang)) {
				const [first, , , fourth, mark] = hang.chars;
				if (!sameLine(first, mark) || !sameLine(fourth, mark)) {
					problems.push('hangingPunct="1": the 。 wrapped instead of hanging');
				} else if (mark.right <= hang.boxRight) {
					problems.push('hangingPunct="1": the 。 does not reach past the margin');
				}
			}
			if (fullwidth(noHang)) {
				const [first, , , fourth, mark] = noHang.chars;
				if (sameLine(first, mark) || !sameLine(fourth, mark)) {
					problems.push('hangingPunct="0": え。 should wrap together');
				}
			}
			if (fullwidth(anywhere)) {
				const [first, , , fourth, bracket] = anywhere.chars;
				if (!sameLine(first, fourth) || sameLine(fourth, bracket)) {
					problems.push('eaLnBrk="0": 」 should start line 2 on its own');
				} else if (Math.abs(bracket.left - first.left) > 2) {
					problems.push('eaLnBrk="0": 」 is not at the start of line 2');
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});

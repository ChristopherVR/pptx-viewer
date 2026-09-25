/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * PowerPoint's East Asian line breaking in every binding, box for box against
 * the lines PowerPoint itself produced (COM `TextRange.Lines()`, recorded in
 * `generate-cjk-line-breaking-fixture.ts`): `hangingPunct="1"` keeps an
 * overflowing `。` on its line past the margin unless a closing bracket
 * follows it, `hangingPunct="0"` wraps it with the character before it,
 * `eaLnBrk="0"` drops kinsoku, and none of it changes when the break falls
 * between two differently formatted runs (see
 * `packages/shared/src/render/text-east-asian-breaks.ts`).
 *
 * Each box is 4.6em wide with zero insets. The spec reads character
 * rectangles from DOM ranges, so it makes no assumption about any binding's
 * span structure, and it skips a box whose font does not give the fullwidth
 * advances the geometry relies on.
 *
 * Fixture: `cjk-line-breaking.pptx` (`generate-cjk-line-breaking-fixture.ts`).
 *
 * Run: bunx playwright test cjk-line-breaking
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { CJK_BREAK_BOXES, cjkBoxText } from './fixtures/generate-cjk-line-breaking-fixture';
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
	return measure(page, CJK_BREAK_BOXES.map(cjkBoxText));
}

/** Whether the font gave the first four characters (near) equal fullwidth advances. */
function fullwidth(layout: BoxLayout): boolean {
	const [a, b] = layout.chars;
	const em = b.left - a.left;
	return (
		em > 0 && layout.chars.slice(0, 4).every((c) => Math.abs(c.right - c.left - em) < em * 0.1)
	);
}

/** The characters grouped into rendered lines (by top edge), in reading order. */
function renderedLines(layout: BoxLayout): string[] {
	const lines: Array<{ top: number; text: string }> = [];
	for (const c of layout.chars) {
		const line = lines.find((l) => Math.abs(l.top - c.top) < 2);
		if (line) {
			line.text += c.ch;
		} else {
			lines.push({ top: c.top, text: c.ch });
		}
	}
	return [...lines].sort((a, b) => a.top - b.top).map((l) => l.text);
}

test.describe('CJK line breaking', () => {
	test('every binding breaks East Asian text where PowerPoint does', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems = CJK_BREAK_BOXES.flatMap((box, i) => {
				const layout = value[i];
				if (!fullwidth(layout)) {
					return [];
				}
				const lines = renderedLines(layout);
				if (lines.join('|') !== box.lines.join('|')) {
					return [`${box.name}: rendered ${lines.join('|')}, PowerPoint ${box.lines.join('|')}`];
				}
				const mark = layout.chars[box.lines[0].length - 1];
				if (box.hangs && mark.right <= layout.boxRight) {
					return [`${box.name}: the hanging ${mark.ch} does not reach past the margin`];
				}
				return [];
			});
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});

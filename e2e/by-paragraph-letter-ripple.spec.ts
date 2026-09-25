/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

/**
 * A "By paragraph" text build whose effect also animates text "By letter".
 *
 * `by-paragraph-letter-ripple.pptx` was authored in PowerPoint through COM: one
 * text box with two 6-letter paragraphs ("ABCDEF", "GHIJKL"), Fade, 1 s,
 * `p:bldP build="p"`, and on each paragraph's effect `p:iterate type="lt"` with
 * the default 10% delay between letters. Paragraph 1 is On Click, paragraph 2
 * After Previous. PowerPoint writes one effect per paragraph, scoped by
 * `<p:pRg st="N" end="N"/>` (an INCLUSIVE range).
 *
 * PowerPoint's own CreateVideo render: paragraph 1's letters start 100 ms
 * apart, and paragraph 2's first letter starts 1500 ms (1000 + 5 * 100) after
 * paragraph 1's first. Reading the range as exclusive made it empty, so every
 * step fell back to the whole text box and was re-split into BOTH paragraphs.
 *
 * Reads only the framework-neutral contract (`#file-input`, `[data-anim-id]`),
 * so it runs against all five bindings.
 */

const deck = resolve(
	fileURLToPath(new URL('./fixtures/by-paragraph-letter-ripple.pptx', import.meta.url)),
);

async function loadDeck(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"], [data-element-id]').first().waitFor();
	await page.waitForTimeout(600);
}

async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
}

/** CSS `animation` shorthand of every staged text-build piece, keyed by id. */
async function buildPieces(page: Page): Promise<Record<string, string>> {
	return page.evaluate(() => {
		const out: Record<string, string> = {};
		for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-anim-id]'))) {
			const id = el.dataset.animId;
			if (id) {
				out[id] = el.style.animation;
			}
		}
		return out;
	});
}

/** The delay (ms) of a CSS `animation` shorthand (`<dur>ms <easing> <delay>ms ...`). */
function delayOf(shorthand: string | undefined): number | undefined {
	const matches = shorthand?.match(/(\d+)ms/gu);
	return matches && matches.length >= 2 ? Number.parseInt(matches[1], 10) : undefined;
}

function delaysFor(pieces: Record<string, string>, paragraph: number): Array<number | undefined> {
	return [0, 1, 2, 3, 4, 5].map((index) => {
		const entry = Object.entries(pieces).find(([id]) => id.endsWith(`::c${paragraph}-${index}`));
		return delayOf(entry?.[1]);
	});
}

test.describe('by-paragraph build that ripples by letter (PowerPoint-authored)', () => {
	test('each paragraph ripples its own letters, the second after the first finishes', async ({
		page,
	}) => {
		await loadDeck(page);
		await startShow(page);
		await page.waitForTimeout(600);
		// Paragraph 1 is On Click.
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(300);

		const pieces = await buildPieces(page);
		const charIds = Object.keys(pieces).filter((id) => /::c\d+-\d+$/u.test(id));
		// One piece per letter: 12, not 24 (each step re-split into both paragraphs).
		expect(charIds).toHaveLength(12);

		expect(delaysFor(pieces, 0)).toStrictEqual([0, 100, 200, 300, 400, 500]);
		expect(delaysFor(pieces, 1)).toStrictEqual([1500, 1600, 1700, 1800, 1900, 2000]);
	});
});

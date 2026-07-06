/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';

/**
 * Ascender/descender clipping regression. Runs against every demo.
 *
 * Fixture: `descender-clip.pptx`, a minimal one-slide deck reading "Jumpy flags".
 * The phrase clips at both edges: ascenders (J, f, l) on top, descenders (p, y,
 * g) below. Box ~67px tall (`cy="640080"`). Font ~64px bold (`sz="4810"`, Arial).
 * Centred (`anchor="ctr"`), `<a:normAutofit/>`, 80% line spacing (`<a:spcPct
 * val="80000"/>`). PowerPoint and Google Slides render it whole.
 *
 * Cause: the text body sets `overflow: hidden` (React on `normAutofit`; Vue and
 * Angular always). The glyph ink is taller than the box, so it gets cropped.
 * PowerPoint never clips a text box's own text. `normAutofit` with no stored
 * `fontScale` means "already fits", so nothing is cropped.
 *
 * Why a custom signal: the scrollHeight check in text-rendering.spec.ts catches
 * layout overflow only. Here the 80% line spacing shrinks the line box to ~51px,
 * which fits the 67px box. No layout overflow. The glyph ink still spills and
 * clips. So we assert the clip switch directly: nothing between the text and its
 * box may clip. We also pin the tight geometry (font ~= box) so the assertion
 * only matters when a clip crops real ink.
 *
 * History: a `test.fail()` pin while the clip existed. The fix (no `overflow:
 * hidden` on text bodies) landed. It is now a live test: it must pass.
 */

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/descender-clip.pptx', import.meta.url)),
);

test.describe('text body clipping (ascender/descender crop)', () => {
	test('normAutofit text box must not clip its own text ("Jumpy flags")', async ({ page }) => {
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(fixturePath);
		await page
			.locator('[data-pptx-element="true"]')
			.filter({ hasText: 'Jumpy flags' })
			.first()
			.waitFor();

		const result = await page.evaluate(() => {
			const host = [...document.querySelectorAll('[data-pptx-element="true"]')].find((e) =>
				e.textContent?.includes('Jumpy flags'),
			) as HTMLElement | undefined;
			if (!host) {
				throw new Error('no slide element containing "Jumpy flags"');
			}

			// Deepest node that directly owns the "Jumpy flags" text.
			let textOwner: HTMLElement = host;
			for (const node of host.querySelectorAll('*')) {
				const ownsText = [...node.childNodes].some(
					(c) => c.nodeType === Node.TEXT_NODE && c.textContent?.includes('Jumpy flags'),
				);
				if (ownsText) {
					textOwner = node as HTMLElement;
				}
			}

			// Clip if anything from the text up to the box hides overflow. That is
			// the crop that removes ascenders and descenders.
			let clipsText = false;
			for (let n: HTMLElement | null = textOwner; n; n = n.parentElement) {
				const ov = getComputedStyle(n).overflowY;
				if (ov === 'hidden' || ov === 'clip') {
					clipsText = true;
				}
				if (n === host) {
					break;
				}
			}

			const fontSizePx = Number.parseFloat(getComputedStyle(textOwner).fontSize);
			const boxHeightPx = host.getBoundingClientRect().height;
			return { clipsText, fontSizePx, boxHeightPx };
		});

		// Tight box: ~64px font in a ~67px box (~0.95 ratio). Near-zero slack, so a
		// clip crops real ink. Deterministic; no font metrics needed.
		expect(result.fontSizePx / result.boxHeightPx).toBeGreaterThan(0.9);

		// The fix: nothing clips, so ascenders and descenders survive.
		expect(result.clipsText).toBe(false);
	});
});

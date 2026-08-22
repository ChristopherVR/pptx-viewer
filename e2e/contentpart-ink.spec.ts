/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Real PowerPoint ink (`p:contentPart` + InkML), run identically across every
 * framework demo.
 *
 * `ole-and-ink.spec.ts` covers `ink-annotation.pptx`, which despite its name is
 * a synthesized `aink:` graphic frame that PowerPoint refuses to open. This
 * spec covers the shape PowerPoint actually writes, using a fixture that IS
 * PowerPoint's own serialization: `mc:Choice Requires="p14"` around a
 * `p:contentPart` bound to an InkML part, with compact difference-encoded trace
 * text. PowerPoint reports both content parts as msoInk at the `p14:xfrm` box.
 *
 * What used to happen, in every binding at once: the `p14` capability set in
 * `mc-capabilities.ts` did not list `contentPart`, so the Choice was rejected
 * and the raster `mc:Fallback` was rendered instead. The fixture's fallback is
 * a grey rectangle reading "ink fallback", so a regression here is visible
 * rather than subtle. On top of that, Vue and Angular had no `contentPart`
 * renderer at all and painted the "unsupported element" placeholder.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/ink-contentpart.pptx', import.meta.url)),
);

/** Slide 1 carries a 31-point red sine plus three blue strokes. */
const SLIDE_1_STROKE_COUNT = 4;
const SINE_LINE_SEGMENTS = 30;
const RED = '#E81123';
const BLUE = '#0078D7';

async function openDeck(page: Page, filePath: string): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(filePath);
	await page.locator('[data-element-id]').first().waitFor();
}

/**
 * The ink strokes on the ACTIVE slide.
 *
 * Scoped to the viewport on purpose: Angular, Svelte and Vanilla render live
 * slide thumbnails, so an unscoped `[data-element-id] svg path` returns the
 * canvas strokes plus every thumbnail's copy (11 rather than 4) and the count
 * would differ per binding for a reason that has nothing to do with ink.
 *
 * Also scoped to `contentPart` element ids: `a:ln/@algn` gained a renderer
 * (the shared SVG stroke-outline overlay), so an ordinary bordered shape now
 * emits its own `<svg><path>` too. An unscoped selector picks up that
 * neighbouring shape's outline path alongside the real ink strokes, which has
 * nothing to do with ink either.
 */
function inkPaths(page: Page): Locator {
	return page.locator('[data-pptx-viewport] [data-element-id*="contentPart"] svg path');
}

async function strokeGeometry(page: Page): Promise<{ d: string; stroke: string }[]> {
	return inkPaths(page).evaluateAll((els) =>
		els.map((el) => ({
			d: el.getAttribute('d') ?? '',
			stroke: (el.getAttribute('stroke') ?? '').toUpperCase(),
		})),
	);
}

test.describe('contentPart ink', () => {
	test('renders decoded InkML strokes rather than the mc:Fallback raster', async ({ page }) => {
		await openDeck(page, fixturePath);

		// The Choice must be taken. Its Fallback is a labelled grey rectangle, so
		// its text is the unambiguous witness that the branch selection regressed.
		await expect(page.locator('body')).not.toContainText('ink fallback');

		const strokes = await strokeGeometry(page);
		expect(strokes.length).toBe(SLIDE_1_STROKE_COUNT);

		// Brush colours come from `<inkml:definitions>`, which a direct-child
		// lookup missed entirely: every stroke used to fall back to black.
		const colours = strokes.map((stroke) => stroke.stroke);
		expect(colours.filter((c) => c === RED)).toHaveLength(1);
		expect(colours.filter((c) => c === BLUE)).toHaveLength(3);

		// The sine is a single difference-encoded trace. Under the old
		// whitespace tokenizer it decoded to ONE point, i.e. an `M` with no `L`.
		const sine = strokes.find((stroke) => stroke.stroke === RED);
		expect(sine?.d.split('L').length ?? 0).toBe(SINE_LINE_SEGMENTS + 1);

		// Every point is normalised into the p14:xfrm box, so nothing is off the
		// element. A raw ink coordinate would be in the thousands.
		const coords = [...(sine?.d ?? '').matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/gu)].flatMap((m) => [
			Number(m[1]),
			Number(m[2]),
		]);
		expect(coords.length).toBeGreaterThan(0);
		expect(Math.max(...coords)).toBeLessThan(1000);
		expect(Math.min(...coords)).toBeGreaterThanOrEqual(0);
	});

	test('keeps a content part selectable as a slide element', async ({ page }) => {
		await openDeck(page, fixturePath);
		// The neutral cross-binding contract: an ink content part is an element,
		// not decoration. Angular and Vue used to route it to the "unsupported"
		// placeholder, which is still an element box, so assert the strokes are
		// inside the SAME marked, content-part-identified element rather than
		// merely present somewhere. Scoped to `contentPart` ids so a
		// neighbouring shape's own stroke-outline overlay (a real `<svg><path>`
		// now that `a:ln/@algn` has a renderer) cannot be counted as a second
		// match; the "unsupported" placeholder still carries the content part's
		// id but paints no `svg path`, so the regression this guards stays caught.
		const marked = page.locator(
			'[data-pptx-viewport] [data-pptx-element="true"][data-element-id*="contentPart"]',
		);
		const withInk = marked.filter({ has: page.locator('svg path') });
		await expect(withInk).toHaveCount(1);
	});

	test('survives a save and reload with its stroke geometry intact', async ({ page }) => {
		await openDeck(page, fixturePath);
		const before = await strokeGeometry(page);
		expect(before.length).toBe(SLIDE_1_STROKE_COUNT);

		const download = await savePptxViaBackstage(page);
		const outDir = fileURLToPath(new URL('../test-results/contentpart-ink/', import.meta.url));
		const { mkdirSync } = await import('node:fs');
		mkdirSync(outDir, { recursive: true });
		const savedPath = resolve(outDir, `${test.info().project.name}-contentpart-ink.pptx`);
		await download.saveAs(savedPath);

		await openDeck(page, savedPath);
		const after = await strokeGeometry(page);
		expect(after).toEqual(before);
	});
});

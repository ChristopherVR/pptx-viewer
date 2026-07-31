/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Gradient and pattern OUTLINES (`a:ln/a:gradFill`, `a:ln/a:pattFill`), run
 * identically against every framework demo.
 *
 * A CSS `border` takes one flat colour, so both were painted from a single
 * value the parser computed as a stand-in: a gradient outline collapsed to an
 * averaged colour and a patterned one to the pattern's bare foreground, losing
 * its hatching entirely. Both are now stroked as a real SVG path over the
 * element, following the shape's own geometry, with the CSS border dropped so
 * the flat colour cannot show underneath.
 *
 * The fixture is generated (`e2e/fixtures/generate-pattern-outline-fixture.ts`)
 * because no deck in the corpus authored a patterned outline. Its four shapes
 * cover the pattern path, a pattern on a ROUND outline, the gradient path, and a
 * solid control that must keep its cheap CSS border.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/pattern-outline.pptx', import.meta.url)),
);

/** Element ids, in the order the fixture generator writes them. */
const SHAPE = {
	patternRect: 'slide1.xml-shape-0',
	patternEllipse: 'slide1.xml-shape-1',
	gradientRect: 'slide1.xml-shape-2',
	solidRect: 'slide1.xml-shape-3',
} as const;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 1"]').first().waitFor({ timeout: 60_000 });
	await page.waitForTimeout(1200);
}

/** Outline paint for one element id, measured on its largest rendered copy. */
async function outlineOf(page: Page, suffix: string) {
	return page.evaluate((id) => {
		let host: HTMLElement | undefined;
		let best = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith(id)) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > best) {
				best = box.width * box.height;
				host = node;
			}
		}
		if (!host) {
			return null;
		}
		const path = host.querySelector('svg path[stroke^="url("]');
		const pattern = host.querySelector('svg pattern');
		const image = pattern?.querySelector('image');
		return {
			borderWidth: Number.parseFloat(getComputedStyle(host).borderTopWidth) || 0,
			strokedPath: path?.getAttribute('d') ?? null,
			strokeRef: path?.getAttribute('stroke') ?? null,
			patternId: pattern?.getAttribute('id') ?? null,
			tile: pattern ? `${pattern.getAttribute('width')}x${pattern.getAttribute('height')}` : null,
			// `href` may be set via the SVG namespace in some bindings.
			tileHref:
				image?.getAttribute('href') ??
				image?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
				null,
			gradientStops: [...(host.querySelectorAll('svg linearGradient stop') ?? [])].map((s) =>
				s.getAttribute('stop-color'),
			),
		};
	}, suffix);
}

test.describe('gradient and pattern outlines', () => {
	test('a patterned outline is stroked with a real pattern tile', async ({ page }) => {
		await loadDeck(page);
		const outline = await outlineOf(page, SHAPE.patternRect);

		expect(outline, 'found the pattern-outlined rectangle').not.toBeNull();
		expect(outline?.patternId, 'a <pattern> paint server is defined').toBeTruthy();
		expect(outline?.strokeRef).toBe(`url(#${outline?.patternId})`);
		// The tile repeats on its own grid rather than stretching to the shape.
		expect(outline?.tile).toBe('8x8');
		// Both pattern colours reach the tile: foreground hatch on its background.
		const tile = decodeURIComponent(String(outline?.tileHref));
		expect(tile).toContain('#1F4E79');
		expect(tile).toContain('#FFF2CC');
		// The flat CSS border is gone, so the bare foreground cannot show through.
		expect(outline?.borderWidth).toBe(0);
	});

	test('a patterned outline follows a round shape, not its bounding box', async ({ page }) => {
		await loadDeck(page);
		const outline = await outlineOf(page, SHAPE.patternEllipse);

		expect(outline?.patternId, 'the ellipse has a pattern paint server').toBeTruthy();
		// An ellipse is otherwise drawn with `border-radius`; the overlay has to
		// trace the real outline or the hatched border would be a rectangle.
		expect(outline?.strokedPath).toContain('A ');
	});

	test('a gradient outline still strokes with its own paint server', async ({ page }) => {
		await loadDeck(page);
		const outline = await outlineOf(page, SHAPE.gradientRect);

		expect(outline?.gradientStops).toStrictEqual(['#FF0000', '#0000FF']);
		expect(outline?.strokeRef).toContain('url(#');
		expect(outline?.borderWidth).toBe(0);
	});

	test('a solid outline keeps its CSS border', async ({ page }) => {
		await loadDeck(page);
		const outline = await outlineOf(page, SHAPE.solidRect);

		// The overlay is for paints a border cannot express; a solid outline stays
		// on the cheaper CSS path.
		expect(outline?.strokedPath, 'no stroke overlay for a solid outline').toBeNull();
		expect(outline?.borderWidth, 'the CSS border still paints it').toBeGreaterThan(0);
	});
});
